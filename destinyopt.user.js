// ==UserScript==
// @name         Destiny Opt
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://www.bungie.net/en/Legend/Gear/*
// @grant        none
// @require http://code.jquery.com/jquery-1.11.3.min.js
// @require https://raw.githubusercontent.com/lodash/lodash/4.12.0/dist/lodash.js

// ==/UserScript==


(function() {
  'use strict';
  window.$j = jQuery.noConflict(true);
  window.dOpt = {
    util: {
      waitForAjax: function (interval) {
        interval = interval || 0;
        return new Promise(function (resolve, reject) {
          var pollForAjax;
          pollForAjax = function (interval) {
            if ($j.active === 0) {
              resolve('instant');
            } else {
              return setTimeout(function () {
                return pollForAjax(interval);
              }, interval);
            }
          };
          return pollForAjax(interval);
        });
      },

      waitForElement: function(elementPath){
        return new Promise(function(resolve, reject){
          var poll = function(){
            window.setTimeout(function(){
              if($j(elementPath).length > 0){
                resolve($(elementPath));
              }else{
                poll();
              }
            },500);
          };
          return poll();
        });
      }
    },

    itemsStats: function(bucket) {
      bucket = bucket || 'BUCKET_PRIMARY_WEAPON';
      return $j('.' + bucket + ' .bucketItem').map(function(indx,el){
        return {name: $j(el).find('.itemName').text(),
        stat: $j(el).find('.primaryStat .statValue').attr('data-statvalue'),
        el: el};
      });
    },

    optBuckets: ["BUCKET_PRIMARY_WEAPON",
                  "BUCKET_SPECIAL_WEAPON",
                  "BUCKET_HEAVY_WEAPON",
                  "BUCKET_GHOST",
                  "BUCKET_HEAD",
                  "BUCKET_ARMS",
                  "BUCKET_CHEST",
                  "BUCKET_LEGS",
                  "BUCKET_CLASS_ITEMS"],

    //"BUCKET_ARTIFACT"

    pickBestLight: function(bucket){
        return new Promise(function(resolve, reject){
          var best = _.maxBy(dOpt.itemsStats(bucket), function(w){return parseInt(w.stat);});
          if($j(best.el).hasClass('equipped')){
            console.log('best', bucket, 'already equipped', best.name);
            resolve(false);
          }
          else {
            console.log("picking", best);
            $j(best.el).click();
            dOpt.util.waitForElement('div.button.equipItem').then(function(){
              $j('div.button.equipItem').click();
              resolve(true);
            });
          }
        });
    },

    pickBestAll: () => {
      var dup = dOpt.optBuckets.slice();
      var fst = dup.pop();
      var pickBestLoop = (list, start) => {
        dOpt.pickBestLight(start).then(() => {
          if(list.length > 0){
            var nex = list.pop();
            console.log('setting', nex);
            pickBestLoop(list, nex);
          }
          else {
            console.log('done!');
          }
        });
      };
      pickBestLoop(dup, fst);
    }
  };
})();
