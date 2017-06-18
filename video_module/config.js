module.exports = {
    FRAME_INTERVAL: 3,   //interval between downloaded frames in seconds
    START_SECOND: 10,    //second that frames start to download at
    MAX_SECOND: 2000,     //max second that frames will be downloaded at
    VIDEO_QUALITY: 22,   //itag value of video resolution https://en.wikipedia.org/wiki/YouTube#Quality_and_formats
    MAX_FRAMES_AT_SAME_TIME : 3,
    MAX_TOLERATED_FRAME_FAILURES : 20,

    REQUESTS_PER_SECOND: 10,
    FRAME_PIC_WIDTH: 1280,
    FRAME_PIC_HEIGHT: 720,
    TOLERATED_VERIFY_CONFIDENCE: 0.5,
    BACKOFF_TIME: 500,

    ATHLETE_IMAGE_COUNT: 3,

    EDIT_DISTANCE_DIVISION: 5,
    FACE_EDIT_DISTANCE_DIVISION: 3,
    //approximate location of name tag
    NAME_TAG_LOC: {
        LEFTX: 400,
        LEFTY: 540,
        RIGHTX: 830,
        RIGHTY: 650,
    },
    REQUEST_TIMEOUT : 15000
};