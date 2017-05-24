"use strict";

const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const faststart = require('faststart');
const utils = require('./utils.js');
const Frame = require('./frame.js');
const frameProcessor = require('./frame_processor');

const properties = {
    interval: 4,
    startSeconds: 10,
    maxSeconds: 150
};

function generateIntervalArray(){
    let arr = [];
    for(let i = properties.startSeconds; i <= properties.maxSeconds; i += properties.interval){
        arr.push(i);
    }
    return arr;
}

/*
    1. Downloads youtube video at url
    2. Extracts frames at given intervals
    3. Processes frames and passes array into callback
    params:
        url : url of youtube video
        cb : callback which has array parameter
 */

function gatherVideoData(url, cb){
    //Create Directory
    let dir = './data/' + url.substring(url.lastIndexOf('=') + 1, url.length);
    let videodir = dir + '/video';
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir);
        fs.mkdirSync(videodir);
    }
    console.log("Created video directory at: " + dir);

    //Download youtube video
    let video = ytdl(url, { quality: 22});
    video.pipe(fs.createWriteStream(videodir + '/video.mp4'));
    video.on('progress', (chunkLength, downloaded, total) => {
        console.log((downloaded / total * 100).toFixed(2) + '% ');
    });
    video.on('end', () => {
        console.log("Begin querying ocr");
        //extract frames from downloaded video
        //need to find out which is faster recursive one by one or iterative all at once
        //getFramesRec(dir, videodir + '/video.mp4', generateIntervalArray(), 0);
        getFrames(dir, videodir + '/video.mp4', generateIntervalArray(), cb);
    });
}

/*
 iteratively extract frames one by one
 because its way faster this way
 https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/449
 */
function getFrames(dir, file, timestamps, cb){
    let callbackCount = 0;
    let numFrames = 0;
    let relevantFrames = [];
    let imagesdir = dir + '/images';
    if(!fs.existsSync(imagesdir)){
        fs.mkdirSync(imagesdir);
    }
    for(let i = 0; i < timestamps.length; i++){
        let timestamp = timestamps[i];
        ffmpeg(file)
            .on('end', () => {
                let imagePath = dir + '/images/' + timestamp + '.png';

                //return if screenshot did not occur
                if(!fs.existsSync(imagePath)) return;

                numFrames++;

                console.log("Took screenshot at ", timestamp, " seconds");

                /*
                if(numFrames === timestamps.length){
                    console.timeEnd("test");
                }
                */

                utils.queryOcr(imagePath, (err, responseCode, responseBody) => {
                    callbackCount++;
                    if(err){
                        console.log("Error ", err);
                        //reject(err);
                    }
                    let body = JSON.parse(responseBody);
                    let frame = new Frame(timestamp, imagesdir, imagePath, body);
                    //console.log("Body ", body);

                    //check if frame contains data
                    if(body['regions'] && body['regions'].length > 0){
                        relevantFrames.push(frame);
                    }
                    if(callbackCount === numFrames){
                        relevantFrames.sort((a, b) => {
                            return a.getTime() - b.getTime();
                        });
                        console.log("RelevantFrames: ", relevantFrames);
                        cb(relevantFrames);
                    }
                });
            })
            .screenshots({
                count: 1,
                timestamps: [timestamp],
                filename: '%s.png',
                folder: dir + '/images/'
            });
    }
}

const testDir = './data/VZvoufQy8qc';
const testVideoDir = testDir + '/video';

//TODO: add multiple queries on same video
//TODO: handle all errors


getFrames(testDir, testVideoDir + '/video.mp4', generateIntervalArray(), (relevantFrames) => {
    //console.log("Result ", relevantFrames);
    frameProcessor.processFrames(relevantFrames, (res) => {
        console.log("Result ", res);
    });
});



/*
 gatherVideoData('https://www.youtube.com/watch?v=VZvoufQy8qc', (relevantFrames) => {
     frameProcessor.processFrames(relevantFrames, (res) => {
         console.log("Result ", res);
     });
 });
*/

//console.time("test");
/*
gatherVideoData('https://www.youtube.com/watch?v=rp4NKWb7dXk', (res) => {
    console.log("Result ", res);
});
*/

/*
    Recursively extract frames one by one
    because its way faster this way
    https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/449



function getFramesRec(dir, file, timestamps, i){
    if(i >= timestamps.length){
        console.error("index out of bounds for file: ", file);
        return;
    }
    let timestamp = timestamps[i];
    ffmpeg(file)
        .on('end', function(){
            console.log("Took screenshot at ", timestamp, " seconds");

            const formData = {
                file : fs.createReadStream(dir + '/images/' + timestamp + '.png')
            };

            const options = {
                url: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/ocr?language=unk&detectOrientation=false',
                headers: {
                    'Ocp-Apim-Subscription-Key' : secrets.keys.ocr
                },
                formData : formData,
                method: 'POST'
            };

            if(i + 1 < timestamps.length){
                getFramesRec(dir, file, timestamps, i+1);
            }
            else{
                console.timeEnd("test");
                console.log("Finished");
            }
        })
        .screenshots({
            count: 1,
            timestamps: [timestamp],
            filename: '%s.png',
            folder: dir + '/images/'
        });
}

 */

