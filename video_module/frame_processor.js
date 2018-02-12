"use strict";
const fs = require('fs');
const utils = require('./utils.js');
const athleteProfiler = require('./athlete_profiler.js');
const config = require('./config.js');
const io = require('../socket');


const Promise = require('bluebird');

Promise.config({
    cancellation: true,
});

let frameProcessor = function(logger, socketId){
    this.logger = logger;
    this.socketId = socketId;
};

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
    let min = 1000;
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
    if(end === -1){
        end = frames.length - 1;
    }
    if(!found){
        return false;
    }
    let res = {};
    res['begin'] = begin;
    res['end'] = end;
    return res;
}

function findStartList(frames) {
    let beginAndEndIndex = findBeginAndEndStartListIndex(frames);
    if(!beginAndEndIndex) return false;
    let begin = beginAndEndIndex['begin'];
    let end = beginAndEndIndex['end'];
    let startListFrame = frames[Math.floor((end+begin)/2)];
    this.logger.info("Found start frame at : ", startListFrame.getTime());
    this.logger.debug('First start frame occurrence %d, last start frame occurrence %d', frames[begin].getTime(), frames[end].getTime());
    return startListFrame;
}

function getAllAthletesFromStartList(startListFrame){
    let frameData = startListFrame.getData();

    let startLoc = containsWord(frameData, "start");
    this.logger.debug("Found word 'start' in startlist frame at: " , startLoc);

    let leftX = Number(startLoc.split(',')[0]);
    let leftY = Number(startLoc.split(',')[1]) + Number(startLoc.split(',')[3]);
    let regions = frameData['regions'];
    this.logger.debug("Startlist frame regions: ", regions);
    let rightX = leftX;
    let rightY = leftY;
    for(let i = 0; i < regions.length; i++){
        if(regions[i]['lines']){
            for(let j = 0; j < regions[i]['lines'].length; j++){
                let valrx = Number(regions[i]['lines'][j]['boundingBox'].split(',')[0]) + Number(regions[i]['lines'][j]['boundingBox'].split(',')[2]);
                let valry = Number(regions[i]['lines'][j]['boundingBox'].split(',')[1]) + Number(regions[i]['lines'][j]['boundingBox'].split(',')[3]);
                if(valrx >= rightX){
                    rightX = valrx;
                }
                if(valry >= rightY){
                    rightY = valry;
                }
            }
        }
    }
    this.logger.info('Cropping start list frame at leftX: %d, leftY: %d, rightX: %d, rightY: %d', leftX, leftY, rightX, rightY);

    let that = this;

    return new Promise((resolve, reject) => {
        utils.crop(startListFrame.getImagePath(), startListFrame.getDir() + '/startlist.png', leftX, leftY, rightX, rightY).then((image) => {
            that.logger.info('successfully cropped startlist');
            that.logger.info('Begin OCR of startlist');
            io.broadcastTo(that.socketId, 'progressUpdate', {value: 10, type: 'process'});

            return utils.queryOcr(startListFrame.getDir() + '/startlist.png');
        }).then((responseBody) => {
            let body = JSON.parse(responseBody);
            if (body['regions']) {
                let promises = [];
                for (let i = 0; i < body['regions'].length; i++) {
                    for (let j = 0; j < body['regions'][i]['lines'].length; j++) {
                        let line = "";
                        for (let k = 0; k < body['regions'][i]['lines'][j]['words'].length; k++) {
                            if (line !== '')
                                line += (" " + body['regions'][i]['lines'][j]['words'][k].text);
                            else
                                line += body['regions'][i]['lines'][j]['words'][k].text;
                        }
                        that.logger.debug('Checking if %s is an athlete', line);

                        promises.push(athleteProfiler.getAthleteProfile(line));
                    }
                }
                Promise.all(promises).then((promiseAthletes) => {
                    io.broadcastTo(that.socketId, 'progressUpdate', {value: 50, type: 'process'});
                    let athletes = [];
                    for (let i = 0; i < promiseAthletes.length; i++) {
                        let athlete = promiseAthletes[i];
                        if (athlete) {
                            that.logger.info('%s is an athlete', athlete.getOcrName());
                            that.logger.debug('Athlete profile: ', athlete);
                            athletes.push(athlete);
                        }
                    }
                    that.logger.info('Found %d athletes', athletes.length);
                    that.logger.info('Athlete names: ', athletes.map((athlete) => {
                        return athlete.getName();
                    }));
                    that.logger.debug("athletes: ", athletes);
                    resolve(athletes);
                }).catch((err) => {
                    that.logger.error('error getting athlete profile: ', err);
                    reject(err);
                });
            }
            else {
                that.logger.error('No text was found for start list frame', startListFrame);
                reject('Could not find any text in start list frame');
            }
        }).catch((err) => {
            that.logger.error('Error in getAllAthletesFromStartList: ', err);
            reject(err);
        });
    });
}

//Returns a promise for easy usage
function findAthleteInFrame(athletes, frame){
    let that = this;
    return new Promise((resolve, reject) => {
        let croppedFrameData = frame.getCroppedData();
        let minEditAthleteDistance = {distance: 1000, text: ''}; //text is the athlete name/part of name that gave the min distance
        let minAthlete = null;
        let secondMinAthleteEditDistance = {distance: 1000, text: ''};
        let secondMinAthlete = null;
        for (let i = 0; i < athletes.length; i++) {
            let athlete = athletes[i];
            if (!athlete) continue;
            let athleteNameSplit = [athlete.getName()].concat(athlete.getName().split(" ")).concat([athlete.getOcrName()]).filter((name) => {
                return (name !== ' ' && name !== '');
            });
            for (let i = 0; i < athleteNameSplit.length; i++) {
                let editDistance = minimumEditDistance(croppedFrameData, athleteNameSplit[i]);
                if (editDistance <= minEditAthleteDistance.distance) {
                    secondMinAthleteEditDistance = minEditAthleteDistance;
                    secondMinAthlete = minAthlete;
                    minEditAthleteDistance = {distance: editDistance, text: athleteNameSplit[i]};
                    minAthlete = athlete;
                }
                else if (editDistance <= secondMinAthleteEditDistance.distance) {
                    secondMinAthleteEditDistance = {distance: editDistance, text: athleteNameSplit[i]};
                    secondMinAthlete = athlete;
                }
            }
        }
        //Primary match using OCR
        if (minEditAthleteDistance.distance <= Math.floor(minEditAthleteDistance.text.length / config.EDIT_DISTANCE_DIVISION)) {
            that.logger.info('Athlete at %d seconds is %s, editdistance %d', frame.getTime(), minAthlete.getName(), minEditAthleteDistance.distance);
            resolve(minAthlete);
        }
        //Secondary match using face recognition
        else if (minAthlete && minEditAthleteDistance.distance <= Math.floor(minEditAthleteDistance.text.length / config.FACE_EDIT_DISTANCE_DIVISION)) {
            that.logger.info('edit distance: ', minEditAthleteDistance.distance, ' athlete name ', minAthlete.getName(), ' is very similar to ', croppedFrameData);
            let p = utils.faceVerify(frame.getImagePath(), minAthlete).then((result) => {
                if (result) {
                    that.logger.info('Athlete at %d seconds is %s', frame.getTime(), minAthlete.getName());
                    resolve(minAthlete);
                    p.cancel();
                }
                else if (secondMinAthlete && secondMinAthleteEditDistance.distance <= Math.floor(secondMinAthleteEditDistance.text.length / config.FACE_EDIT_DISTANCE_DIVISION)) {
                    that.logger.info('edit distance: ', secondMinAthleteEditDistance.distance, ' athlete name ', secondMinAthlete.getName(), ' is very similar to ');
                    return utils.faceVerify(frame.getImagePath(), secondMinAthlete);
                }
                else {
                    that.logger.info('No athlete found at %d seconds', frame.getTime());
                    resolve(null);
                    p.cancel();
                }
            }).then((result) => {
                if (result) {
                    that.logger.info('Athlete at %d seconds is %s', frame.getTime(), secondMinAthlete.getName());
                    resolve(secondMinAthlete);
                }
                else {
                    that.logger.info('No athlete found at %d seconds', frame.getTime());
                    resolve(null);
                }
            }).catch((err) => {
                reject(err);
            });
        }
        else {
            that.logger.info('No athlete found at %d seconds', frame.getTime());
            resolve(null);
        }
    });
}

frameProcessor.prototype.processFrames = function(relevantFrames){
    let that = this;
    return new Promise((resolve, reject) => {
        getAllAthletesFromStartList.bind(this)(findStartList.bind(this)(relevantFrames)).then((athletes) => {
            let promises = [];
            let lastStartListFrame = findBeginAndEndStartListIndex(relevantFrames)['end'];

            for(let i = lastStartListFrame+1; i < relevantFrames.length; i++){
                let frame = relevantFrames[i];
                promises.push(findAthleteInFrame.bind(this)(athletes, frame));
            }

            Promise.all(promises).then((res) => {
                io.broadcastTo(that.socketId, 'progressUpdate', {value: 90, type: 'process'});
                that.logger.info('Processed frame results');
                for(let i = 0; i < res.length; i++){
                    relevantFrames[lastStartListFrame+1+i].setAthleteInFrame(res[i]);
                    if(res[i] !== null){
                        that.logger.info('Athlete at %d seconds is %s', relevantFrames[lastStartListFrame+1+i].getTime(), res[i].getName());
                    }
                    else{
                        that.logger.info('No athlete found at %d seconds', relevantFrames[lastStartListFrame+1+i]. getTime());
                    }
                }
                resolve(relevantFrames.filter((frame) => {
                    return (frame.getAthleteInFrame() !== null) && (frame.getAthleteInFrame() !== undefined);
                }));
            })
            .catch((err) => {
                //TODO ADD MAX TOLERATED FRAME FAILURES
                that.logger.error('Error finding athlete in frame: ', err);
                reject(err);
            });

        }).catch((err) => {
            that.logger.error('Error getting athletes from startlist: ', err);
            reject(err);
        });
    });
};

module.exports = frameProcessor;
