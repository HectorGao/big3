const {createStore}=require('./lib/store');
App({store:createStore(wx),globalData:{selectedLift:null}});
