const winston = require('winston');
const fs = require('fs');
const youtubeDownloader = require('./youtube_downloader.js');
const frameProcessor = require('./frame_processor');
const moment = require('moment');

const Promise = require('bluebird');

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
    const dir = './data/' + urlId;
    const videodir = dir + '/video';
    const imagesdir = dir + '/images';
    if(!fs.existsSync(dir)){

        fs.mkdirSync(dir);
        fs.mkdirSync(videodir);
        fs.mkdirSync(imagesdir);
    }

    logger.info('Video directory created at %s', dir);

    youtubeDownloader.getRelevantVideoFrames(url, logger, (relevantFrames) => {
        logger.info('Begin processing relevant frames');

        frameProcessor.processFrames(relevantFrames, logger, (res) => {
            console.log("Result ", res);
        });
    });
}

processVideo('https://www.youtube.com/watch?v=VZvoufQy8qc');


/*
const testDir = './data/VZvoufQy8qc';
const testVideoDir = testDir + '/video';

//TODO: add multiple queries on same video
//TODO: handle all errors

//TODO use objects
getFrames(testDir, testVideoDir + '/video.mp4', generateIntervalArray(), (relevantFrames) => {
    //console.log("Result ", relevantFrames);
    frameProcessor.processFrames(relevantFrames, (res) => {
        console.log("Result ", res);
    });
});
*/