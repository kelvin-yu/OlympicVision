'use strict';

let Athlete = function(name, images, wikipedia){
    this._name = name;
    this._images = images;
    this._wikipedia = wikipedia;
};

Athlete.prototype.getName = function(){
    return this._name;
};

Athlete.prototype.setName = function(name){
    this._name = name;
};

Athlete.prototype.getImages = function(){
    return this._images;
};

Athlete.prototype.setImages = function(images){
    this._images = images;
};

Athlete.prototype.addImage = function(image){
    this._images.push(image);
};

Athlete.prototype.getWikipedia = function(){
    return this._wikipedia;
};

Athlete.prototype.setWikipedia = function(wikipedia){
    this._wikipedia = wikipedia;
};

module.exports = Athlete;