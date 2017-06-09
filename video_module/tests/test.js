const it = require("mocha").it;
const describe = require("mocha").describe;
const expect = require('chai').expect;
describe('test', function(){
    describe('inner test', function(){
        it('does that', function() {
            expect(1+1).to.equal(2);
        });
    });
});