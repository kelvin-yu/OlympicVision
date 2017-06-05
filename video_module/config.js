const Properties = {
    FrameInterval: 4,   //interval between downloaded frames in seconds
    StartSecond: 10,    //second that frames start to download at
    MaxSecond: 50,     //max second that frames will be downloaded at
    VideoQuality: 22,   //itag value of video resolution https://en.wikipedia.org/wiki/YouTube#Quality_and_formats

    RateLimiterSeconds: 7,
    FramePicWidth: 1920,
    FramePicHeight: 1080,
    TOLERATED_VERIFY_CONFIDENCE: 0.5,
    BACKOFF_TIME: 500,

    ATHLETE_IMAGE_COUNT: 3,

    EDIT_DISTANCE_DIVISION: 5,
    FACE_EDIT_DISTANCE_DIVISION: 3,
    //approximate location of name tag
    LeftX: 330,
    LeftY: 880,
    RightX: 1600,
    RightY: 1000,
};

exports.Properties = Properties;
