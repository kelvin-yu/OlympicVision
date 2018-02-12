const winston = require('winston');
const fs = require('fs');
const youtube_downloader = require('./youtube_downloader.js');
const frame_processor = require('./frame_processor');
const moment = require('moment');
const config = require('./config');
const io = require('../socket');

const Promise = require('bluebird');

function squashAthleteInFrames(processedFrames){
    let squashedFrames = [];
    let prevAthleteName;
    let prevFrameTime = 0;
    for(let frame of processedFrames){
        let frameAthleteName = frame.getAthleteInFrame().getName();
        let timeDifference = frame.getTime() - prevFrameTime;
        prevFrameTime = frame.getTime();
        if(prevAthleteName === frameAthleteName && timeDifference <= config.FRAME_INTERVAL * 2){
            continue;
        }
        prevAthleteName = frameAthleteName;
        squashedFrames.push(frame);
    }
    return squashedFrames;
}

//TODO move this to another file
exports.processVideo = function(url, socketId){
    const urlId =  url.substring(url.lastIndexOf('=') + 1, url.length);

    // set up logger
    const loggerId = urlId + '_' + Date.now().toString();
    winston.loggers.add(loggerId);
    let logger = winston.loggers.get(loggerId);
    //logger.remove(winston.transports.Console);
    logger.add(winston.transports.File, {
        name : 'info-file',
        filename : './video_module/logs/' + loggerId,
        json : false,
        level : 'info',
        formatter : function(options) {
            // Return string will be passed to logger.
            return moment().format("MM/DD/YYYY hh:mm:ss") + '-' +
                options.level.toUpperCase() + ' ' +
                (options.message ? options.message : '') +
                (options.meta && Object.keys(options.meta).length ? '\n' + JSON.stringify(options.meta, null, 2) : '');
        }
    });
    logger.add(winston.transports.File, {
        name : 'debug-file',
        filename : './video_module/logs/' + loggerId + '_debug',
        json : false,
        level : 'debug',
        formatter : function(options) {
            // Return string will be passed to logger.
            return options.level.toUpperCase() + ' ' +
                (options.message ? options.message : '') +
                (options.meta && Object.keys(options.meta).length ? '\n' + JSON.stringify(options.meta, null, 2) : '');
        }
     });

    // set up directory structure
    const base = './video_module/data/' + urlId;
    let dirNum = 0;

    /* Removed for testing purposes
    if(fs.existsSync(base)){
        dirNum++;
        while(fs.existsSync(base + dirNum)){
            dirNum++;
        }
    }
    */

    const dir = base + (dirNum ? dirNum : '');
    const videodir = dir + '/video';
    const imagesdir = dir + '/images';

    /*
    fs.mkdirSync(dir);
    fs.mkdirSync(videodir);
    fs.mkdirSync(imagesdir);
    */

    logger.info('Video directory created at %s', dir);

    let youtubeDownloader = new youtube_downloader(logger, socketId);
    let frameProcessor = new frame_processor(logger, socketId);

    youtubeDownloader.getRelevantVideoFrames(url, dir).then((relevantFrames) => {
        logger.info('Begin processing relevant frames');
        return frameProcessor.processFrames(relevantFrames);
    }).then((processedFrames) => {
        logger.info('Done processing frames');
        let squashedFrames = squashAthleteInFrames(processedFrames);
        let result = [];
        for(let i = 0; i < squashedFrames.length - 1; i++) {
            let curFrame = squashedFrames[i];
            let nextFrame = squashedFrames[i+1];
            if(curFrame.getAthleteInFrame().getName() === nextFrame.getAthleteInFrame().getName()){
                logger.info('%s from %d seconds to %d seconds', curFrame.getAthleteInFrame().getName(), curFrame.getTime(), nextFrame.getTime());
                result.push({athlete : curFrame.getAthleteInFrame(), startTime : curFrame.getTime(), endTime : nextFrame.getTime()});
            }
        }
        io.broadcastTo(socketId, 'progressUpdate', {value: 100, type: 'process'});
        io.broadcastTo(socketId, 'processResult', result);
    }).catch((err) => {
        logger.error('Error processing video url: ', url, ' err: ', err);
    });
};

