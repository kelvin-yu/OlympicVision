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
    const base = './data/' + urlId;
    let i = 0;

    while(fs.existsSync(base + i)){
        i++;
    }

    const dir = base + i;
    const videodir = dir + '/video';
    const imagesdir = dir + '/images';

    fs.mkdirSync(dir);
    fs.mkdirSync(videodir);
    fs.mkdirSync(imagesdir);

    logger.info('Video directory created at %s', dir);

    youtubeDownloader.getRelevantVideoFrames(url, logger).then((relevantFrames) => {
        logger.info('Begin processing relevant frames');
        return frameProcessor.processFrames(relevantFrames, logger);
    }).then((processedFrames) => {
        logger.info('Done');
    }).catch((err) => {
        logger.error('Error processing video url: ', url, ' err: ', err);
    });
}

processVideo('https://www.youtube.com/watch?v=VZvoufQy8qc');

//TODO: add multiple queries on same video
//TODO: handle all errors
//TODO use objects
