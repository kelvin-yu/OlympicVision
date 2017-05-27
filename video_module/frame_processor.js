"use strict";
const fs = require('fs');
const utils = require('./utils.js');
const athleteProfiler = require('./athlete_profiler.js');

function containsWord(body, word){
    if(body['regions']){
        for(let i = 0; i < body['regions'].length; i++){
            if(body['regions'][i]['lines']){
                for(let j = 0; j < body['regions'][i]['lines'].length; j++){
                    if(body['regions'][i]['lines'][j]['words']){
                        for(let k = 0; k < body['regions'][i]['lines'][j]['words'].length; k++){
                            if(body['regions'][i]['lines'][j]['words'][k].text && body['regions'][i]['lines'][j]['words'][k].text.toUpperCase() === word.toUpperCase()){
                                return body['regions'][i]['lines'][j]['words'][k]['boundingBox'];
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

function editDistance(str1, str2){
    let dp = new Array(str1.length+1);
    for(let i = 0; i < dp.length; i++){
        dp[i] = new Array(str2.length+1).fill(1000);
    }

    for(let i = 0; i <= str1.length; i++){
        for(let j = 0; j <= str2.length; j++){
            if(i === 0)
                dp[i][j] = j;
            else if(j === 0)
                dp[i][j] = i;
            else if(str1[i-1] === str2[j-1])
                dp[i][j] = dp[i-1][j-1];
            else
                dp[i][j] = 1 + Math.min(dp[i][j-1],  // Insert
                        dp[i-1][j],  // Remove
                        dp[i-1][j-1]);
        }
    }

    return dp[str1.length][str2.length];
}

function minimumEditDistance(body, word){
    let min = word.length;
    if(body['regions']){
        for(let i = 0; i < body['regions'].length; i++){
            if(body['regions'][i]['lines']){
                for(let j = 0; j < body['regions'][i]['lines'].length; j++){
                    if(body['regions'][i]['lines'][j]['words']){
                        for(let k = 0; k < body['regions'][i]['lines'][j]['words'].length; k++){
                            let text = body['regions'][i]['lines'][j]['words'][k].text && body['regions'][i]['lines'][j]['words'][k].text.toUpperCase();
                            min = Math.min(min, editDistance(text, word.toUpperCase()));
                        }
                    }
                }
            }
        }
    }
    return min;
}

function findBeginAndEndStartListIndex(frames){
    if (!frames) return false;
    let found = false;
    let begin = -1;
    let end = -1;
    for (let i = 0; i < frames.length; i++) {
        let frame = frames[i];
        if (containsWord(frame.getData(), "start")) {
            if(!found){
                found = true;
                begin = i;
            }
        }
        else if(found){
            end = i-1;
            if(i + 1 < frames.length && !containsWord(frames[i+1].getData(), 'start'))
                break;
        }
    }
    if(!found){
        return false;
    }
    let res = {};
    res['begin'] = begin;
    res['end'] = end;
    return res;
}

function findStartList(frames, logger) {
    let beginAndEndIndex = findBeginAndEndStartListIndex(frames);
    if(!beginAndEndIndex) return false;
    let begin = beginAndEndIndex['begin'];
    let end = beginAndEndIndex['end'];
    let startListFrame = frames[Math.floor((end+begin)/2)];
    logger.info("Found start frame at : ", startListFrame.getTime());
    logger.debug('First start frame occurrence %d, last start frame occurrence %d', frames[begin].getTime(), frames[end].getTime());
    return startListFrame;
}

function getAllAthletesFromStartList(startListFrame, logger, cb){
    let frameData = startListFrame.getData();

    let startLoc = containsWord(frameData, "start");
    logger.debug("Found word 'start' in startlist frame at: " , startLoc);

    let leftX = Number(startLoc.split(',')[0]);
    let leftY = Number(startLoc.split(',')[1]) + Number(startLoc.split(',')[3]);
    let regions = frameData['regions'];
    logger.debug("Startlist frame regions: ", regions);
    let rightX = leftX;
    let rightY = leftY;
    for(let i = 0; i < regions.length; i++){
        if(regions[i]['lines']){
            for(let j = 0; j < regions[i]['lines'].length; j++){
                let valrx = Number(regions[i]['lines'][j].boundingBox.split(',')[0]) + Number(regions[i]['lines'][j].boundingBox.split(',')[2]);
                let valry = Number(regions[i]['lines'][j].boundingBox.split(',')[1]) + Number(regions[i]['lines'][j].boundingBox.split(',')[3]);
                if(valrx >= rightX){
                    rightX = valrx;
                }
                if(valry >= rightY){
                    rightY = valry;
                }
            }
        }
    }
    logger.info('Cropping start list frame at leftX: %d, leftY: %d, rightX: %d, rightY: %d', leftX, leftY, rightX, rightY);
    utils.crop(startListFrame, startListFrame.getDir() + '/startlist.png', leftX, leftY, rightX, rightY, (image) => {
        console.log("Begin OCR of startlist");
        utils.queryOcr(startListFrame.getDir() + '/startlist.png', (err, response, responseBody) => {
            if(err){
                console.log("OCR of startlist error: ", err);
                return;
            }
            let body = JSON.parse(responseBody);
            let callbackCount = 0;
            let expectedCallbackCount = 0;
            let athletes = [];
            let athleteCount = 0;
            if(body['regions']){
                for(let i = 0; i < body['regions'].length; i++){
                    expectedCallbackCount += body['regions'][i]['lines'].length;
                }
                for(let i = 0; i < body['regions'].length; i++){
                    for(let j = 0; j < body['regions'][i]['lines'].length; j++){
                        let line = "";
                        for(let k = 0; k < body['regions'][i]['lines'][j]['words'].length; k++){
                            if(line !== '')
                                line += (" " + body['regions'][i]['lines'][j]['words'][k].text);
                            else
                                line += body['regions'][i]['lines'][j]['words'][k].text;
                        }
                        logger.debug('Checking if %s is an athlete', line);
                        athleteProfiler.getAthleteProfile(line, (err, athlete) => {
                            callbackCount++;
                            if(err){
                                logger.error("Error when getting profile for ", line);
                            }
                            if(athlete){
                                logger.info('%s is an athlete', line);
                                logger.debug('Athlete profile: ', athlete);
                                athletes.push(athlete);
                                athleteCount++;
                            }
                            if(callbackCount === expectedCallbackCount){
                                logger.info('Found %d athletes', athleteCount);
                                logger.info('Athlete names: ', athletes.map((athlete) => {
                                    return athlete.getName();
                                }));
                                logger.debug("athletes: ", athletes);
                                cb(athletes);
                            }
                        });
                    }
                }
            }
            else{
                logger.warn('Somehow no text was found for start list frame', startListFrame);
                cb(athletes);
            }
        });
    });
}

const EDIT_DISTANCE_DIVISION = 5;
//approximate location of name tag
const leftX = 200;
const leftY = 550;
const rightX = 1100;
const rightY = 675;

//Returns a promise for easy usage
function findAthleteInFrame(athletes, frame, logger){
    return new Promise((resolve, reject) => {
        utils.crop(frame, frame.getDir() + '/cropped_' + frame.getTime() + '.png', leftX, leftY, rightX, rightY, (image) => {
            utils.queryOcr(frame.getDir() + '/cropped_' + frame.getTime() + '.png', (err, responseCode, responseBody) => {
                if(err){
                    logger.error('Error finding athlete in frame: ', err);
                    reject(err);
                    return;
                }
                let body = JSON.parse(responseBody);
                let minEditAthleteDistance = 1000;
                let minAthlete = null;
                let secondMinAthleteEditDistance = 1000;
                let secondMinAthlete = null;
                for(let i = 0; i < athletes.length; i++){
                    let athlete = athletes[i];
                    if(!athlete) continue;
                    let athleteNameSplit = [athlete.getName()].concat(athlete.getName().split(" ")).concat([athlete.getOcrName()]).filter((name) => {
                        return (name !== ' ' && name !== '');
                    });
                    for(let i = 0; i < athleteNameSplit.length; i++){
                        let editDistance = minimumEditDistance(body, athleteNameSplit[i]);
                        if(editDistance <= minEditAthleteDistance){
                            secondMinAthleteEditDistance = minEditAthleteDistance;
                            secondMinAthlete = minAthlete;
                            minEditAthleteDistance = editDistance;
                            minAthlete = athlete;
                        }
                        else if(editDistance <= secondMinAthleteEditDistance){
                            secondMinAthleteEditDistance = editDistance;
                            secondMinAthlete = athlete;
                        }
                    }
                }
                logger.debug('minEditDistanceAthlete: %s in frame at %d seconds', minAthlete.getName(), frame.getTime());
                logger.debug('secondMinEditDistanceAthlete: %s in frame at %d seconds', secondMinAthlete.getName(), frame.getTime());

                let returnedTrue = false;
                if(minEditAthleteDistance <= Math.floor(minAthlete.getName().length / EDIT_DISTANCE_DIVISION)){
                    logger.info('Athlete at %d seconds is %s', frame.getTime(), minAthlete.getName());
                    resolve(minAthlete);
                }
                else{
                    let expectedCallbackCount = 0;
                    if(minAthlete) expectedCallbackCount += minAthlete.getImages().length;
                    if(secondMinAthlete) expectedCallbackCount += secondMinAthlete.getImages().length;
                    let callbackCount = 0;
                    if(minAthlete){
                        for(let i = 0; i < minAthlete.getImages().length; i++){
                            utils.faceVerify(frame.getImagePath(), minAthlete.getImages()[i], (isMatch) => {
                                callbackCount++;
                                if(!returnedTrue && isMatch){
                                    returnedTrue = true;
                                    logger.info('Athlete at %d seconds is %s', frame.getTime(), minAthlete.getName());
                                    resolve(minAthlete);
                                }
                                if(callbackCount === expectedCallbackCount && !returnedTrue){
                                    logger.info('No athlete found at %d seconds', frame.getTime());
                                    resolve(null);
                                }
                            });
                        }
                    }
                    if(secondMinAthlete){
                        for(let i = 0; i < secondMinAthlete.getImages().length; i++){
                            utils.faceVerify(frame.getImagePath(), secondMinAthlete.getImages()[i], (isMatch) => {
                                callbackCount++;
                                if(!returnedTrue && isMatch){
                                    returnedTrue = true;
                                    logger.info('Athlete at %d seconds is %s', frame.getTime(), secondMinAthlete.getName());
                                    resolve(secondMinAthlete);
                                }
                                if(callbackCount === expectedCallbackCount && !returnedTrue){
                                    logger.info('No athlete found at %d seconds', frame.getTime());
                                    resolve(null);
                                }
                            });
                        }
                    }
                }
            });
        });
    });
}

exports.processFrames = function processFrames(relevantFrames, logger, cb){
    getAllAthletesFromStartList(findStartList(relevantFrames, logger), logger,  (athletes) => {
        let callbacks = [];
        let lastStartListFrame = findBeginAndEndStartListIndex(relevantFrames)['end'];
        for(let i = lastStartListFrame+1; i < relevantFrames.length; i++){
            let frame = relevantFrames[i];
            callbacks.push(findAthleteInFrame(athletes, frame, logger));
        }
        Promise.all(callbacks).then((res) => {
            logger.info('Processed frame results');
            for(let i = 0; i < res.length; i++){
                relevantFrames[lastStartListFrame+1+i].setAthleteInFrame(res[i]);
                if(res[i] !== null){
                    logger.info('Athlete at %d seconds is %s', relevantFrames[lastStartListFrame+1+i].getTime(), res[i].getName());
                }
                else{
                    logger.info('No athlete found at %d seconds', relevantFrames[lastStartListFrame+1+i]. getTime());
                }
            }
            cb(relevantFrames);
        })
        .catch((err) => {
            logger.error('Error processing frames: ', err);
        });
    });
};
