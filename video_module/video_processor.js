const winston = require('winston');
const fs = require('fs');
const youtubeDownloader = require('./youtube_downloader.js');
const frameProcessor = require('./frame_processor');
const moment = require('moment');
const config = require('./config');

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
function processVideo(url){
    const urlId =  url.substring(url.lastIndexOf('=') + 1, url.length);

    // set up logger
    const loggerId = urlId + '_' + Date.now().toString();
    winston.loggers.add(loggerId);
    let logger = winston.loggers.get(loggerId);
    //logger.remove(winston.transports.Console);
    logger.add(winston.transports.File, {
        name : 'info-file',
        filename : './logs/' + loggerId,
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
        filename : './logs/' + loggerId + '_debug',
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
    const base = './data/' + urlId;
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

    youtubeDownloader.getRelevantVideoFrames(url, dir, logger).then((relevantFrames) => {
        logger.info('Begin processing relevant frames');
        return frameProcessor.processFrames(relevantFrames, logger);
    }).then((processedFrames) => {
        logger.info('Done processing frames');
        //logger.info(processedFrames);
        let squashedFrames = squashAthleteInFrames(processedFrames);
        /*
        for(let frame of squashedFrames){
            logger.info('Time: %d, athleteName: ', frame.getTime(), frame.getAthleteInFrame().getName());
        }
        */
        let result = [];
        for(let i = 0; i < squashedFrames.length - 1; i++) {
            let curFrame = squashedFrames[i];
            let nextFrame = squashedFrames[i+1];
            if(curFrame.getAthleteInFrame().getName() === nextFrame.getAthleteInFrame().getName()){
                logger.info('%s from %d seconds to %d seconds', curFrame.getAthleteInFrame().getName(), curFrame.getTime(), nextFrame.getTime());
                result.push({athlete : curFrame.getAthleteInFrame(), startTime : curFrame.getTime(), endTime : nextFrame.getTime()});
            }
        }
    }).catch((err) => {
        logger.error('Error processing video url: ', url, ' err: ', err);
    });
}

processVideo('https://www.youtube.com/watch?v=VZvoufQy8qc');

//TODO: add multiple queries on same video
//TODO: handle all errors
//TODO use objects
