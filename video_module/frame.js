"use strict";

let Frame = function(time, dir, imagePath, data){
    this._time = time;
    this._dir = dir;
    this._imagePath = imagePath;
    this._data = data;
};

Frame.prototype.getTime = function(){
    return this._time;
};

Frame.prototype.setTime = function(time){
    this._time = time;
};

Frame.prototype.getDir = function(){
    return this._dir;
};

Frame.prototype.setDir = function(dir){
    this._dir = dir;
};

Frame.prototype.getImagePath = function(){
    return this._imagePath;
};

Frame.prototype.setImagePath = function(imagePath){
    this._imagePath = imagePath;
};

Frame.prototype.getData = function(){
    return this._data;
};

Frame.prototype.setData = function(data){
    this._data = data;
};

Frame.prototype.getAthleteInFrame = function(){
    return this.athleteInFrame;
};

Frame.prototype.setAthleteInFrame = function(athleteInFrame){
    this._athleteInFrame =athleteInFrame;
};

module.exports = Frame;