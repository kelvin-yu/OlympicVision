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
        dp[i] = new Array(str2.length+1);
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
            break;
        }
    }
    if(!found){
        return false;
    }
    let res = {};
    res['begin'] = begin;
    res['end'] = end;
    console.log("begin and end: ", res);
    return res;
}

function findStartList(frames) {
    let beginAndEndIndex = findBeginAndEndStartListIndex(frames);
    if(!beginAndEndIndex) return false;
    let begin = beginAndEndIndex['begin'];
    let end = beginAndEndIndex['end'];
    //console.log("Begin: ", begin, " End: ", end);
    let startListFrame = frames[Math.floor((end+begin)/2)];
    console.log("Startlist frame: ", startListFrame.getTime());
    return startListFrame;
}

function getAllAthletesFromStartList(startListFrame, cb){
    let frameData = startListFrame.getData();
    //Location of first word
    let startLoc = containsWord(frameData, "start");
    console.log("Startloc" , startLoc);
    let leftX = Number(startLoc.split(',')[0]);
    let leftY = Number(startLoc.split(',')[1]) + Number(startLoc.split(',')[3]);
    let regions = frameData['regions'];
    console.log("Regions: ", regions);
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
    utils.crop(startListFrame, startListFrame.getDir() + '/startlist.png', leftX, leftY, rightX, rightY, (image) => {
        console.log("Query startlist");
        utils.queryOcr(startListFrame.getDir() + '/startlist.png', (err, responseCode, responseBody) => {
            if(err){
                console.log("Query startlist error: ", err);
            }
            let body = JSON.parse(responseBody);
            let callbackCount = 0;
            let expectedCallbackCount = 0;
            let res = [];
            if(body['regions']){
                for(let i = 0; i < body['regions'].length; i++){
                    expectedCallbackCount += body['regions'][i]['lines'].length;
                }
                for(let i = 0; i < body['regions'].length; i++){
                    for(let j = 0; j < body['regions'][i]['lines'].length; j++){
                        let line = "";
                        for(let k = 0; k < body['regions'][i]['lines'][j]['words'].length; k++){
                            line += (" " + body['regions'][i]['lines'][j]['words'][k].text);
                        }
                        console.log("count here ", line);
                        athleteProfiler.getAthleteProfile(line, (err, athlete) => {
                            callbackCount++;
                            if(err){
                                console.log("Error when profiling: ", line);
                                console.log("err: ", err);
                            }
                            //console.log("Callback count: ", callbackCount, " Athlete ", athlete);
                            if(athlete){
                                res.push(athlete);
                            }
                            if(callbackCount === expectedCallbackCount){
                                cb(res);
                            }
                        });
                    }
                }

            }
            else{
                console.log("Something weird happened");
            }
        });
    });
}

const EDIT_DISTANCE_DIVISION = 4;
//approximate location of name tag
const leftX = 200;
const leftY = 550;
const rightX = 1100;
const rightY = 675;

//Returns a promise for easy usage
function findAthleteInFrame(athletes, frame){
    return new Promise((resolve, reject) => {
        utils.crop(frame, frame.getDir() + '/cropped_' + frame.getTime(), leftX, leftY, rightX, rightY, (image) => {
            utils.queryOcr(frame.getDir() + '/cropped_' + frame.getTime(), (err, responseCode, responseBody) => {
                if(err){
                    console.log("getAthleteFromFrame error", err);
                    reject(err);
                }
                let body = JSON.parse(responseBody);
                let minEditAthleteDistance = 1000;
                let minAthlete = null;
                let secondMinAthleteEditDistance = 1000;
                let secondMinAthlete = null;
                for(let athlete in athletes){
                    let athleteNameSplit = athlete.getName().split(" ");
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

                if(minEditAthleteDistance <= Math.floor(athlete.getName().length() / EDIT_DISTANCE_DIVISION)){
                    resolve(minAthlete);
                    return;
                }
                else{

                }

                resolve(null);
            });
        });
    });
}

exports.processFrames = function processFrames(relevantFrames, cb){
    getAllAthletesFromStartList(findStartList(relevantFrames), (athletes) => {
        let callbacks = [];
        let lastStartListFrame = findBeginAndEndStartListIndex(relevantFrames)['end'];
        for(let i = lastStartListFrame+1; i < relevantFrames.length; i++){
            let frame = relevantFrames[i];
            callbacks.push(findAthleteInFrame(athletes, frame));
        }
        Promise.all(callbacks).then((res) => {
            for(let i = 0; i < res.length; i++){
                relevantFrames[i].setAthleteInFrame(res[i]);
            }
            cb(relevantFrames);
        });
    });
};

//200, 550  -    1100, 675