"use strict";

const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const utils = require('./utils.js');
const Frame = require('./frame.js');
const config = require('./config.js');
const io = require('../socket');

const Promise = require('bluebird');

let youtubeDownloader = function(logger, socketId){
    this.logger = logger;
    this.socketId = socketId;
};

function generateIntervalQueue(){
    let q =  new utils.Queue();
    for(let i = config.START_SECOND; i <= config.MAX_SECOND; i += config.FRAME_INTERVAL){
        q.enqueue(i);
    }
    return q;
}

/*
    1. Downloads youtube video at url
    2. Extracts frames at given intervals
    3. Processes frames and passes array into callback
    params:
        url : url of youtube video
    returns:
        promise
 */


youtubeDownloader.prototype.getRelevantVideoFrames = function(url, dir){
    const videodir = dir + '/video';

    /* FOR TESTING PURPOSES
    */

    if(fs.existsSync(videodir + '/video.mp4')){
        io.broadcastTo(this.socketId, 'progressUpdate', {value: 100, type: 'youtube'});
        this.logger.info("Begin extracting frames from video");
        return getFrames.bind(this)(dir, videodir + '/video.mp4', generateIntervalQueue());
    }

    /* FOR TESTING PURPOSES
     */

    //Download youtube video
    let that = this;
    return new Promise((resolve, reject) => {
        try{
            let video = ytdl(url, { quality: config.VIDEO_QUALITY});
            video.pipe(fs.createWriteStream(videodir + '/video.mp4'));
            let percent = 0;
            video.on('info', (info, format) => {
                that.logger.info('Video length: ', info.length_seconds + ' seconds');
                config.MAX_SECOND = info.length_seconds;
            });
            video.on('progress', (chunkLength, downloaded, total) => {
                let cur = Math.ceil((downloaded / total * 100));
                if(cur > percent){
                    percent = cur;
                    that.logger.info('Youtube video download progress: ', percent + '% ');
                    io.broadcastTo(that.socketId, 'progressUpdate', {value : percent, type : 'youtube'});
                }
            });
            video.on('end', () => {
                that.logger.info("Begin extracting frames from video");
                //extract frames from downloaded video
                resolve();
            });
        }
        catch(e){
            that.logger.error('error downloading youtube video, err: ', e);
            reject(e);
        }
    }).then(() => {
        return getFrames.bind(this)(dir, videodir + '/video.mp4', generateIntervalQueue());
    }).catch((err) => {
        return Promise.reject(err);
    });
};

/*
    Recursively extract frames one by one
    because its way faster this way
    https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/449
*/

function getFrames(dir, file, timestampsQueue){
    let relevantFrames = [];
    let imagesdir = dir + '/images';
    let callbackCount = 0;
    let errorCount = 0;
    let framesBeingProcessed = 1;
    let that = this;

    return new Promise((resolve, reject) => {
        (function getFrame(timestamp){
            try{
                ffmpeg(file)
                    .on('end', function(){
                        let imagePath = imagesdir + '/' + timestamp + '.png';
                        let croppedImagePath = imagesdir + '/cropped_' + timestamp + '.png';

                        //make sure screenshot exists
                        if(fs.existsSync(imagePath)){
                            that.logger.info("Took frame at ", timestamp, " seconds");

                            let croppedFrameData;

                            utils.crop(imagePath, croppedImagePath, config.NAME_TAG_LOC.LEFTX, config.NAME_TAG_LOC.LEFTY, config.NAME_TAG_LOC.RIGHTX, config.NAME_TAG_LOC.RIGHTY).then(() => {
                                return utils.queryOcr(croppedImagePath);
                            }).then((croppedResponseBody) => {
                                croppedFrameData = JSON.parse(croppedResponseBody);
                                if(croppedFrameData['regions'] && croppedFrameData['regions'].length > 0){ //there is something in cropped frame
                                    return utils.queryOcr(imagePath);
                                }
                                else{ //there is nothing in the cropped frame
                                    return Promise.resolve("{}");
                                }
                            }).then((responseBody) => {
                                let frameData = JSON.parse(responseBody);
                                let frame = new Frame(timestamp, imagesdir, imagePath, croppedImagePath, frameData, croppedFrameData);
                                if(croppedFrameData['regions'] && croppedFrameData['regions'].length > 0){
                                    that.logger.info('Relevant frame at %d seconds', frame.getTime());
                                    that.logger.debug('Frame data: ', frame);
                                    relevantFrames.push(frame);
                                }
                            }).catch((err) => {
                                errorCount++;
                                that.logger.error("Error during OCR for image at %s ", imagePath, ' err: ', err);
                            }).finally(() => {
                                if(errorCount > config.MAX_TOLERATED_FRAME_FAILURES){
                                    reject("Exceeded MAX_TOLERATED_FRAME_FAILURES");
                                }

                                io.broadcastTo(that.socketId, 'progressUpdate', {value : Math.round(100 * callbackCount / timestampsQueue.totalEnqueued), type : 'getFrames'});

                                callbackCount++;
                                if(callbackCount === timestampsQueue.totalEnqueued){
                                    console.log('here');
                                    relevantFrames.sort((a, b) => {
                                        return a.getTime() - b.getTime();
                                    });
                                    that.logger.info("Found %d relevant frames", relevantFrames.length);
                                    that.logger.info('Timestamps of relevant frames', relevantFrames.map((frame) => {
                                        return frame.getTime();
                                    }));
                                    that.logger.debug("relevantFrames: ", relevantFrames);
                                    io.broadcastTo(that.socketId, 'progressUpdate', {value : 100, type : 'getFrames'});
                                    resolve(relevantFrames);
                                }
                            });
                        }
                        else{
                            that.logger.warn('Missing frame at %d seconds', timestamp);
                        }
                        //process next frame
                        framesBeingProcessed--;
                        while(framesBeingProcessed < config.MAX_FRAMES_AT_SAME_TIME && timestampsQueue.size() > 0){
                            framesBeingProcessed++;
                            getFrame(timestampsQueue.dequeue());
                        }
                    })
                    .screenshots({
                        count: 1,
                        timestamps: [timestamp],
                        filename: '%s.png',
                        folder: dir + '/images/',
                        size: String(config.FRAME_PIC_WIDTH) + 'x' + String(config.FRAME_PIC_HEIGHT)
                    });
            }
            catch(e){
                that.logger.error('ffmpeg error, err: ', e);
                reject(e);
            }
        })(timestampsQueue.dequeue());
    });
}

module.exports = youtubeDownloader;
