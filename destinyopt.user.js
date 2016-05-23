// ==UserScript==
// @name         Destiny Opt
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Make robots to play games for us
// @author       You
// @match        https://www.bungie.net/en/Legend/Gear/*
// @grant        none
// @require http://code.jquery.com/jquery-1.11.3.min.js
// @require https://raw.githubusercontent.com/lodash/lodash/4.12.0/dist/lodash.js

// ==/UserScript==
/*jshint esnext: true*/

(function() {
  'use strict';
  window.$j = jQuery.noConflict(true);
  window.dOpt = {
    util: {
      waitForAjax: (interval) => {
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
        var baseStats = {name: $j(el).find('.itemName').text(),
        light: $j(el).find('.primaryStat .statValue').attr('data-statvalue'),
        el: el};
        var statEls = $j(el).find('span[data-statid]');
        var otherStats = _.map(statEls, (sStat) => [$j(sStat).attr('data-statid'), $j(sStat).attr('data-statvalue')]);
        _.each(otherStats, (s) => baseStats[s[0]] = s[1]);

        return baseStats;
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

    optStats: () => _.uniq(_.map($j('tr.itemStat'), (is) => $j(is).attr('data-id'))),


    currentEquips: () => {
       return _.map($j('div.bucketItem.equipped'),
              (el) => { return $j(el).attr('data-iteminstanceid'); });
    },

    saveEquips: (name) => {
        name = name || "_default_equips";
        var model = {
          equips: dOpt.currentEquips()
        };
        window.localStorage.setItem(name, JSON.stringify(model));
        dOpt.ui.displayMessage("Saved " + name + " with equips " + JSON.stringify(model));
    },

    loadEquips: (name) => {
        name = name || "_default_equips";
        var model = JSON.parse(window.localStorage.getItem(name));
        if(model){
          console.log('attempting to load', model.equips);
          dOpt.equipList(model.equips);
        } else {
          dOpt.ui.displayMessage("no loadout named" + name);
        }
    },

    equipList: (instanceIds) => {
      var equipId = (id) => {
        return new Promise((resolve, reject) => {
          var el = $j('div.bucketItem[data-iteminstanceid=' + id + ']');
          var name = $j(el).find('div.itemName').text();
          if(el.length > 0) {
            if(el.hasClass('equipped')){
              dOpt.ui.displayMessage('Already Equipped:' + name);
              resolve(false);
            }
            else {
              $j(el).click();
              dOpt.util.waitForElement('div.button.equipItem').then(function(){
                $j('div.button.equipItem').click();
                dOpt.ui.displayMessage('Equipped: ' + name);
                resolve(true);
              });
            }
          }
          else {
            reject("can't find " + id);
          }
        });
      };

      var equipRecurse = (list) => {
        var currId = _.head(list);
        if(list.length === 0){
          console.log('done!');
          return true;
        }
        else {
          return equipId(currId).then(ret => {
            console.log('equipped', currId, ret);
            equipRecurse(_.tail(list));
          });
        }
      };

      return equipRecurse(instanceIds);
    },

    pickBestForStat: (bucket, stat) => {
      return new Promise(function(resolve, reject){
        var best = _.maxBy(dOpt.itemsStats(bucket), function(w){return parseInt(w[stat]);});

        if(!best){
          dOpt.ui.displayMessage('No ' + stat + ' items for ' + bucket);
          resolve(false);
        }
        else if($j(best.el).hasClass('equipped')){
          //console.log('best', bucket, 'already equipped', best.name);
          dOpt.ui.displayMessage('Already Equipped: ' + best.name + ' (best ' + stat + ' in ' + bucket + ')');
          resolve(false);
        }
        else {
          //console.log("picking", best);
          $j(best.el).click();
          dOpt.util.waitForElement('div.button.equipItem').then(function(){
            $j('div.button.equipItem').click();
            dOpt.ui.displayMessage('Equipped: ' + best.name + ' (best ' + stat + ' in ' + bucket + ')');
            resolve(true);
          });
        }
      });
    },

    pickBestFromSelected: () => {
      var dup = dOpt.optBuckets.slice();
      var fst = dup.pop();
      var targetStat = $j('#statSelector').val();
      var pickBestLoop = (list, start, memo) => {
        memo = memo || [];
        dOpt.pickBestForStat(start, targetStat).then((resp) => {
          memo.push(resp);
          if(list.length > 0){
            var nex = list.pop();
            console.log('setting', nex);
            pickBestLoop(list, nex, memo);
          }
          else {
            console.log('done!');
          }
        });
      };
      pickBestLoop(dup, fst);
    },

    ui: {
      addUi: () => {
        var controlsDiv = `
           <div id="dopt-inv-controls">
              <select id="statSelector">
                  <option value="light">Light</option>
              </select>
              <br>
              <button onclick="dOpt.pickBestFromSelected()">Optimize</button><br>
              <button onclick="dOpt.saveEquips('quicksave')">Save Current Config</button><br>
              <button onclick="dOpt.loadEquips('quicksave')">Load Saved Config</button><br>
              <button onclick="dOpt.viewConfig('quicksave')">View Saved Config (this doesn't work right now)</button><br>
           </div>`;

         var msgDiv = `
           <div id="dopt-messages">
             <button onclick="dOpt.ui.clearMessages()">Clear Messages</button><br>
             <ul id="dopt-message-list">
               <li>Ready! Click the title above to show/hide<li>
             </ul>
           </div>`;

        var template = `
          <div id="dopt">
            <div onclick=dOpt.ui.showHideUi() id="dopt-header">
              <h1>Destiny Optimizer</h1>
            </div>
            <div id="dopt-main">
              ${controlsDiv}
              ${msgDiv}
            </div>
          </div>`;

        $j('#guardianTop').prepend(template);
        _.each(dOpt.optStats(), (stat) => {
            var htmls = '<option value="' + stat + '">' + stat + '</option>';
            $j('#statSelector').append(htmls);
        });
      },

      displayMessage: (msg) => {
        $j('#dopt-message-list').append('<li>' + msg + '</li>');
      },

      clearMessages: () => {
        $j('#dopt-message-list').html('');
      },

      showHideUi: () => { $j('#dopt-main').toggle(); }
    }
  };

  $j(document).ready(dOpt.ui.addUi);
})();
