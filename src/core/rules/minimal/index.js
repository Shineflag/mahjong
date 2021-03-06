'use strict';

var Constants = require('../../constants');
var Tiles = require('../../tiles');

var FSA = require('./fsa');
var AI = require('./ai');
var scoreplayers = require('./scoring');

class Ruleset {

  constructor() {
    this.END_HAND_ON_ILLEGAL_WIN = true;
    this.STARTING_POINTS = 0;
  }

  getStartWind() {
    return 0;
  }

  getAI() {
    return AI;
  }

  resolveIllegalWin(players, player) {
    return scoreplayers.processIllegalWin(players, player);
  }

  /**
   * Can this player claim the tile they want to claim for the purpose they indicated?
   */
  canClaim(player, tile, claimType, winType) {
    if (claimType === Constants.PAIR && winType === Constants.PAIR) { return this.canClaimSet(player, tile, 1); }
    if (claimType <= Constants.CHOW3) { return this.canClaimChow(player, tile, claimType); }
    if (claimType === Constants.PUNG) { return this.canClaimSet(player, tile, 2); }
    if (claimType === Constants.KONG) { return this.canClaimSet(player, tile, 3); }
    if (claimType === Constants.WIN)  { return this.canClaimWin(player, tile, claimType, winType); }
    return false;
  }

  /**
   * check if this player can form a chow with the indicted tile
   * given the tiles that they currently hold.
   */
  canClaimChow(player, tile, claimType) {
    var suit = Tiles.getTileSuit(tile);
    if (suit >= Constants.HONOURS) return false;
    // check for connecting tiles in the same suit
    var fullsuit = Tiles.getSuitTiles(suit);
    var tpos = fullsuit.indexOf(tile);
    var tiles = player.tiles;
    if (claimType === Constants.CHOW1) {
      return tpos+2<Constants.NUMMOD && tiles.indexOf(tile+1)>-1 && tiles.indexOf(tile+2)>-1;
    }
    if (claimType === Constants.CHOW2) {
      return tpos>0 && tpos+1<Constants.NUMMOD && tiles.indexOf(tile-1)>-1 && tiles.indexOf(tile+1)>-1;
    }
    if (claimType === Constants.CHOW3) {
      return tpos>1 && tiles.indexOf(tile-1)>-1 && tiles.indexOf(tile-2)>-1;
    }
    // we can't reasonably get here.
    return false;
  }

  /**
   * check if this player can form a set of size inhandcount+1 given
   * the tiles that they currently hold.
   */
  canClaimSet(player, tile, inhandcount) {
    var instances = 0;
    player.tiles.forEach((t,idx) => { if(t===tile) instances++; });
    return (instances >= inhandcount);
  }

  /**
   * Verifying a win is a complicated process, and is highly ruleset dependent.
   * This ruleset implements the simplest verification possible: does the player
   * have a way to form four sets and a pair? If so, their claim is deemed valid.
   */
  canClaimWin(player, tile, claimType, winType) {
    // 1. can we claim this thing, outside of winning?
    var claim = (claimType === Constants.WIN) ? winType : claimType;
    if (!this.canClaim(player, tile, claim, winType)) return false;

    // 2. if so, what's left after we resolve that claim?
    player = {
      tiles: player.tiles.slice(),
      bonus: player.bonus.slice(),
      revealed: player.revealed.slice()
    };
    this.processClaim(player, tile, claimType, winType);

    // 3. Can we form any sort of winning pattern with those tiles?
    var covered = this.checkCoverage(player.tiles, player.bonus, player.revealed);
    return covered;
  }

  canClaimSelfDrawnWin(player) {
    var covered = this.checkCoverage(player.tiles, player.bonus, player.revealed);
    return covered;
  }

  /**
   * Determine which tiles to form a set with.
   */
  processClaim(player, tile, claimType, winType) {
    var tiles = player.tiles, set;
    if (claimType === Constants.WIN   && winType === Constants.PAIR)  { set = this.formSet(tile, 2); }
    if (claimType === Constants.CHOW1 || winType === Constants.CHOW1) { set = this.formChow(tile, Constants.CHOW1); }
    if (claimType === Constants.CHOW2 || winType === Constants.CHOW2) { set = this.formChow(tile, Constants.CHOW2); }
    if (claimType === Constants.CHOW3 || winType === Constants.CHOW3) { set = this.formChow(tile, Constants.CHOW3); }
    if (claimType === Constants.PUNG  || winType === Constants.PUNG)  { set = this.formSet(tile, 3); }
    if (claimType === Constants.KONG) { set = this.formSet(tile, 4); }
    if (claimType === Constants.CONCEALED_KONG) {
      set = this.formSet(tile, 4);
      set.concealed = true;
    }

    if (claimType !== Constants.CONCEALED_KONG) {
      tiles.push(tile);
    }

    set.forEach(tile => {
      var pos = tiles.indexOf(tile);
      tiles.splice(pos,1);
    });

    player.revealed.push(set);
    return set;
  }

  awardWinningClaim(player, tile, claimType, winType) {
    var tiles = player.tiles, set;
    if (winType === Constants.PAIR)  { set = this.formSet(tile, 2); }
    if (winType  <= Constants.CHOW3) { set = this.formChow(tile, winType); }
    if (winType === Constants.PUNG)  { set = this.formSet(tile, 3); }

    tiles.push(tile);
    set.forEach(tile => {
      var pos = tiles.indexOf(tile);
      tiles.splice(pos,1);
    });

    player.revealed.push(set);
  }

  // utility function
  formChow(tile, chowtype) {
    if (chowtype === Constants.CHOW1) return [tile, tile+1, tile+2];
    if (chowtype === Constants.CHOW2) return [tile-1, tile, tile+1];
    if (chowtype === Constants.CHOW3) return [tile-2, tile-1, tile];
  }

  // utility function
  formSet(tile, howmany) {
    var set = [];
    while(howmany--) { set.push(tile); }
    return set;
  }

  /**
   * Check whether a given tiles + bonus + revealed situation grants a win
   */
  checkCoverage(tiles, bonus, revealed) {
    var sets = 4;
    var pair = 1;
    revealed.forEach(set => {
      if (set.length >= 3) sets--;
      if (set.length === 2) pair--;
    });

    if (sets<0) { return false; }
    if (pair<0) { return false; }

    return FSA.check(tiles.slice(), pair, sets);
  }

  /**
   * Score a hand, if it ended in a win.
   */
  score(players, windoffset, windoftheround) {
    return scoreplayers(players, windoffset, windoftheround);
  }

  /**
   * determine player rotation when a hand is over.
   */
  rotate(won) {
    // we rotate [0,1,2,3] -> [1,2,3,0] if the hand was won.
    return won? 1 : 1;
    // we also rotate on a draw =)
  }
}

module.exports = Ruleset;
