"use strict";

const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const utils = require('./utils.js');
const Frame = require('./frame.js');
const frameProcessor = require('./frame_processor');

const properties = {
    interval: 2,
    startSeconds: 10,
    maxSeconds: 150,
    videoQuality : 22
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

exports.getRelevantVideoFrames = function getRelevantVideoFrames(url, logger, cb){
    const urlId =  url.substring(url.lastIndexOf('=') + 1, url.length);
    const dir = './data/' + urlId;
    const videodir = dir + '/video';

    /* FOR TESTING PURPOSES
    */

    if(fs.existsSync(videodir)){
        logger.info("Begin extracting frames from video");
        getFrames(dir, videodir + '/video.mp4', generateIntervalArray(), logger, cb);
        return;
    }

    /* FOR TESTING PURPOSES
     */


    //Download youtube video
    let video = ytdl(url, { quality: properties.videoQuality});
    video.pipe(fs.createWriteStream(videodir + '/video.mp4'));
    let percent = 0;
    video.on('progress', (chunkLength, downloaded, total) => {
        let cur = Math.ceil((downloaded / total * 100));
        if(cur > percent){
            percent = cur;
            logger.info('Youtube video download progress: ', percent + '% ');
        }
    });
    video.on('end', () => {
        logger.info("Begin extracting frames from video");
        //extract frames from downloaded video
        //need to find out which is faster recursive one by one or iterative all at once
        //getFramesRec(dir, videodir + '/video.mp4', generateIntervalArray(), 0);
        getFrames(dir, videodir + '/video.mp4', generateIntervalArray(), logger, cb);
    });
};

/*
    Recursively extract frames one by one
    because its way faster this way
    https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/449
*/

function getFrames(dir, file, timestamps, logger, cb){
    let relevantFrames = [];
    let callbackCount = 0;

    (function getFrame(i){
        let imagesdir = dir + '/images';
        let timestamp = timestamps[i];

        //TODO add try catch
        ffmpeg(file)
            .on('end', function(){
                let imagePath = imagesdir + '/' + timestamp + '.png';

                //make sure screenshot exists
                if(fs.existsSync(imagePath)){
                    logger.info("Took frame at ", timestamp, " seconds");

                    utils.queryOcr(imagePath, (err, response, responseBody) => {
                        callbackCount++;
                        if(err){
                            logger.error("Error during OCR for image at %s ", imagePath, ' err: ', err);
                            return;
                        }
                        let body = JSON.parse(responseBody);
                        let frame = new Frame(timestamp, imagesdir, imagePath, body);

                        //check if frame contains text
                        if(body['regions'] && body['regions'].length > 0){
                            logger.info('Relevant frame at %d seconds', frame.getTime());
                            logger.debug('Frame data: ', frame);
                            relevantFrames.push(frame);
                        }

                        if(callbackCount === timestamps.length){
                            relevantFrames.sort((a, b) => {
                                return a.getTime() - b.getTime();
                            });
                            logger.info("Found %d relevant frames", relevantFrames.length);
                            logger.info('Timestamps of relevant frames', relevantFrames.map((frame) => {
                                return frame.getTime();
                            }));
                            logger.debug("relevantFrames: ", relevantFrames);
                            cb(relevantFrames);
                        }
                    });
                }

                //process next frame
                if(i + 1 < timestamps.length){
                    getFrame(i+1);
                }
            })
            .screenshots({
                count: 1,
                timestamps: [timestamp],
                filename: '%s.png',
                folder: dir + '/images/',
                size: '1920x1080'
            });
    })(0);
}

/*
 iteratively extract frames one by one
 because its way faster this way
 https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/449

function getFrames(dir, file, timestamps, logger, cb){
    let callbackCount = 0;
    let numFrames = 0;
    let relevantFrames = [];
    let imagesdir = dir + '/images';
    for(let i = 0; i < timestamps.length; i++){
        let timestamp = timestamps[i];


        ffmpeg(file)
            .on('end', () => {
                let imagePath = dir + '/images/' + timestamp + '.png';

                //return if screenshot did not occur
                if(!fs.existsSync(imagePath)) return;

                numFrames++;

                logger.info("Took frame at ", timestamp, " seconds");

                utils.queryOcr(imagePath, (err, response, responseBody) => {
                    callbackCount++;
                    if(err){
                        logger.error("Error during OCR for image at %s ", imagePath, ' err: ', err);
                        return;
                    }
                    let body = JSON.parse(responseBody);
                    let frame = new Frame(timestamp, imagesdir, imagePath, body);

                    //check if frame contains text
                    if(body['regions'] && body['regions'].length > 0){
                        logger.info('Relevant frame at %d seconds', frame.getTime());
                        logger.debug('Frame data: ', frame);
                        relevantFrames.push(frame);
                    }
                    if(callbackCount === numFrames){
                        relevantFrames.sort((a, b) => {
                            return a.getTime() - b.getTime();
                        });
                        logger.info("Found %d relevant frames", numFrames);
                        logger.info('Timestamps of relevant frames', relevantFrames.map((frame) => {
                            return frame.getTime();
                        }));
                        logger.debug("relevantFrames: ", relevantFrames);
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

 */
