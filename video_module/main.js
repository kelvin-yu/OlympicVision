const videoProcessor = require('./video_processor');
import {VIDEO_FOLDER, IMAGE_FOLDER, Process} from 'models/process'

exports.run = function(youtubeUrl, socketId){
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
    const baseDir = './video_module/data/' + urlId;
    const videoDir = baseDir + VIDEO_FOLDER;
    const imagesDir = baseDir + IMAGE_FOLDER;

    fs.mkdirSync(dir);
    fs.mkdirSync(videoDir);
    fs.mkdirSync(imagesDir);

    logger.info('Video directory created at %s', dir);




    videoProcessor.processVideo(youtubeUrl, )
};