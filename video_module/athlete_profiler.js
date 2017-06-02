"use strict";
const utils = require('./utils.js');
const Athlete = require('./athlete.js');
const IMAGE_COUNT = 3;

const Promise = require('bluebird');

//callback (err, athlete)
exports.getAthleteProfile = function getAthleteProfile(line, cb){
    console.log('line1 ', line);
    utils.bingWebSearch(line + " olympic wikipedia", (bingErr, bingResponseCode, bingResponseBody) => {
        console.log('line2 ', line);
        if(bingErr){
            console.log("Bing err", bingErr);
            cb(bingErr, null);
            return;
        }
        let person = utils.removeDiacritics(getAthleteName(JSON.parse(bingResponseBody)));
        if(person){
            utils.bingImageSearch(person + ' olympic', (bingImageErr, bingImageResponseCode, bingImageResponseBody) => {
                console.log('line3 ', line);
                if(bingImageErr){
                    console.log('Bing Image Error' , bingImageErr);
                    cb(bingImageErr, null);
                }
                else{
                    getAthleteImagesAndFaceIds(JSON.parse(bingImageResponseBody)).then((images) => {
                        console.log('line4 ', line);
                        let athlete = new Athlete(line, person, images, getAthleteWikipedia(JSON.parse(bingResponseBody)));
                        cb(null, athlete);
                    }).catch((err) => {
                        console.log('getAthleteImagesAndFaceIds err: ', err);
                        cb(err, null);
                    });
                }
            });
        }
        else{
            cb(null, false);
        }
    });
};

//returns promise
function getAthleteImagesAndFaceIds(body){
    let images = [];
    let promises = [];
    if(body && body['value']){
        for(let i = 0; i < IMAGE_COUNT && i < body['value'].length; i++){
            let url = body['value'][i]['contentUrl'];
            console.log('url: ', url);
            images.push({url : url, faceIds : []});
            promises.push(utils.faceDetectUrl(url));
        }
        return new Promise((resolve, reject) => {
            Promise.all(promises.map((promise) => {
                return promise.reflect();
            })).then((faceIdRequests) => {
                for(let i = 0; i < faceIdRequests.length; i++) {
                    if (faceIdRequests[i].isFulfilled()) {
                        let faceIdRequestBody = faceIdRequests[i].value();
                        for (let j = 0; j < faceIdRequestBody.length; j++) {
                            let faceId = faceIdRequestBody[j]['faceId'];
                            images[i]['faceIds'].push(faceId);
                        }
                    }
                }
                resolve(images);
            }).catch((err) => {
                reject(err);
            });
        });
    }
    else{
        return Promise.reject('body in getAthleteImagesAndFaceIds is null or not valid, given body: ' + body.toString());
    }
}

function getAthleteName(body){
    if(!body
        || !body['webPages']
        || !body['webPages']['value']
        || !body['webPages']['value'][0]
        || !body['webPages']['value'][0]['name']
        || body['webPages']['value'][0]['name'].toUpperCase().indexOf('WIKIPEDIA') === -1) return false;

    return body['webPages']['value'][0]['name'].split(' -')[0];
}

function getAthleteWikipedia(body){
    if(!body
        || !body['webPages']
        || !body['webPages']['value']
        || !body['webPages']['value'][0]
        || !body['webPages']['value'][0]['name']
        || !body['webPages']['value'][0]['url']
        || body['webPages']['value'][0]['name'].toUpperCase().indexOf('WIKIPEDIA') === -1) return false;

    return body['webPages']['value'][0]['url'];
}