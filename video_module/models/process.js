'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VIDEO_FOLDER = '/video';
const IMAGE_FOLDER = '/images';

const PROCESS_STATE = {
    IN_PROGRESS : 1,
    COMPLETED : 2,
    FAILED : 3
};

const ProcessSchema = new Schema(
    {
        videoUrl: {
            type: String,
            required: true
        },
        dirPath: {
            type: String,
            required: true
        },
        infoLogPath: {
            type: String
        },
        debugLogPath: {
            type: String
        },
        socketId: {
            type: String,
            required: true
        },
        state: {
            type: Number,
            required: true
        }
    }
);

module.exports = {
    'PROCESS_STATE' : PROCESS_STATE,
    'VIDEO_FOLDER' : VIDEO_FOLDER,
    'IMAGE_FOLDER' : IMAGE_FOLDER,
    'ProcessSchema' : mongoose.model('ProcessSchema', ProcessSchema)
};