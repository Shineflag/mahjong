'use strict'

var inquirer = require('inquirer');
var colors = require('cli-color');

var BaseClient = require('../basic/client');
var Constants = require('../../core/constants');
var Tiles = require('../../core/tiles');
var rulesets = require('../../core/rules')
var digest = require('../../core/digest');
var version = require('../../../package.json').version;

var debug = false;

/**
 * A client without an interface
 */
class Client extends BaseClient {
  constructor(name, uuid, port, afterBinding) {
    super(name, uuid, port, afterBinding);

    console.log('');
    console.log(colors.yellowBright('  ███╗   ███╗ █████╗ ██╗  ██╗     ██╗ ██████╗ ███╗   ██╗ ██████╗ '));
    console.log(colors.yellowBright('  ████╗ ████║██╔══██╗██║  ██║     ██║██╔═══██╗████╗  ██║██╔════╝ '));
    console.log(colors.yellowBright('  ██╔████╔██║███████║███████║     ██║██║   ██║██╔██╗ ██║██║  ███╗'));
    console.log(colors.yellowBright('  ██║╚██╔╝██║██╔══██║██╔══██║██   ██║██║   ██║██║╚██╗██║██║   ██║'));
    console.log(colors.yellowBright('  ██║ ╚═╝ ██║██║  ██║██║  ██║╚█████╔╝╚██████╔╝██║ ╚████║╚██████╔╝'));
    console.log(colors.yellowBright('  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ '));
    console.log(colors.whiteBright('                                                  Version ${version}\n'));
  }

  setGameData(data) {
    console.log("\nStarting a round.");
    super.setGameData(data);
  }

  setInitialTiles(tiles, wallSize) {
    console.log("Getting tiles for this round...");
    super.setInitialTiles(tiles, wallSize);
    console.log("Tiles received, starting the round.\n");
  }

  addTile(tile, wallSize) {
    var shortform = Tiles.getShortForm(tile)
    console.log('You received a tile ' + this.colorTile(shortform));
    super.addTile(tile, wallSize);
  }

  colorTile(t) {
    if (t.length===1) {
      if (t==='c') return colors.redBright.bgWhite('C');
      if (t==='f') return colors.green.bgWhite('F');
      return colors.blueBright.bgWhite(t.toUpperCase());
    }
    if (t.indexOf('b')===0) return colors.green.bgWhite(t.replace('b',''));
    if (t.indexOf('c')===0) return colors.redBright.bgWhite(t.replace('c',''));
    if (t.indexOf('d')===0) return colors.blueBright.bgWhite(t.replace('d',''));
    if (t.indexOf('s')===0) return colors.redBright.bgWhite(t.replace('s',''));
    if (t.indexOf('f')===0) return colors.blueBright.bgWhite(t.replace('f',''));
  }

  /**
   * ...
   */
  colorize(tiles) {
    tiles.forEach((t,i) => tiles[i] = this.colorTile(t));
  }

  /**
   * ...
   */
  getOurTileSituation() {
    var playtiles = this.tiles.sort(Constants.sort).map(tile => Tiles.getShortForm(tile));
    this.colorize(playtiles);

    var revealed = ["nothing on the table"];
    if (this.revealed.length>0) {
      revealed = this.revealed.map(set => {
        var mapped = set.map(tile => Tiles.getShortForm(tile));
        this.colorize(mapped);
        return mapped.join('');
      });
    }

    var bonus = ["no bonus tiles"];
    if (this.bonus.length>0) {
      bonus = this.bonus.map(tile => Tiles.getShortForm(tile));
      this.colorize(bonus);
    }

    return ['tiles in hand:', playtiles.join('') + ',', 'open:', revealed.join(' ') + ',', 'bonus:', bonus.join('')];
  }

  /**
   * ...
   */
  getTheirTileSituation(player) {
    var revealed = ["nothing on the table"];
    if (player.revealed.length>0) {
      revealed = player.revealed.map(set => {
        var mapped = set.map(tile => Tiles.getShortForm(tile));
        this.colorize(mapped);
        return mapped.join('');
      });
    }
    var bonus = ["no bonus tiles"];
    if (player.bonus.length>0) {
      bonus = player.bonus.map(tile => Tiles.getShortForm(tile));
      this.colorize(bonus);
    }
    return ['${player.handSize} tiles in hand,', 'open:', revealed.join(' ') + ',', 'bonus:', bonus.join('')];
  }

  /**
   * ...
   */
  getTileSituation() {
    var tiles = this.tiles;
    var tileSituation = [colors.green('[hand ${this.currentGame.handid}, turn ${this.currentGame.turn}, wall: ${this.currentGame.wallSize}]')];
    this.players.forEach(player => {
      let wind = Tiles.getPositionWind(player.position);
      let information = [ colors.whiteBright.bgBlue('${wind}') + colors.whiteBright(':')];
      if (player.position === this.currentGame.position) {
        information.push( colors.yellowBright('${player.name}') + colors.whiteBright(':'));
        information = information.concat(this.getOurTileSituation());
      } else {
        information.push( colors.green('${player.name}') + colors.whiteBright(':'));
        information = information.concat(this.getTheirTileSituation(player));
      }
      tileSituation = tileSituation.concat(information.join(' '));
    });
    tileSituation.push("Your discard?");
    return tileSituation.join('\n');
  }

  /**
   * ...
   */
  discardTile(cleandeal) {
    var tileSituation = this.getTileSituation();
    inquirer
    .prompt([{
      type: 'input',
      name: 'tile',
      message: tileSituation + ':',
      validate: value => {
        let msg = 'Please type a tile in your hand';
        if (!value) return msg;
        if (value === 'q') process.exit(0);
        if (value === 'kong') return true;
        let tile = Tiles.fromShortForm(value);
        if (tile === Constants.NOTILE) return true;
        if (this.tiles.indexOf(tile) === -1) return msg;
        return true;
      }
    }])
    .then(answers => {
      var value = answers.tile;
      if (value === 'kong') { return this.selectKong(); }
      var tile = Tiles.fromShortForm(value);
      this.processTileDiscardChoice(tile);
    });
  }

  /**
   * ...
   */
  selectKong() {
    inquirer
    .prompt([{
      type: 'input',
      name: 'tile',
      message: 'which tile are you declaring a kong for?',
      validate: value => {
        let msg = 'Please type a tile in your hand';
        if (!value) return msg;
        let tile = Tiles.fromShortForm(value);
        if (tile === Constants.NOTILE) return true;
        if (this.tiles.indexOf(tile) === -1) return msg;
        return true;
      }
    }])
    .then(answers => {
      var value= answers.tile;
      var tile = Tiles.fromShortForm(value);
      if (tile !== Constants.NOTILE) {
        this.revealConcealedKong(tile);
      }
    });
  }

  /**
   * ...
   */
  revealConcealedKong(tile) {
    var tiles = [tile, tile, tile, tile];
    this.tiles = this.tiles.filter(_tile => _tile !== tile);
    this.revealed.push(tiles);
    this.connector.publish('set-revealed', { tiles }, () => {
      this.connector.publish('kong-request', { kong: tile });
    });
  }

  /**
   * Determine whether we want to claim a discarded tile
   */
  determineClaim(from, tile, sendClaim) {
    var shortform = Tiles.getShortForm(tile);
    console.log('${this.players[from].name} discarded a tile ' + this.colorTile(shortform));
    inquirer
    .prompt([{
      type: 'input',
      name: 'claim',
      message: 'Claim tile (enter to ignore)? [y/n]',
      validate: value => {
        let msg = 'yes or no?';
        if (value.toLowerCase() === 'y') return true;
        if (value.toLowerCase() === 'n') return true;
        if (value === '') return true;
        return false;
      }
    }])
    .then(answers => {
      if (answers.claim === '') answers.claim = 'n';
      if (answers.claim.toLowerCase() === 'y') { this.getClaimType(sendClaim); }
      else { sendClaim({ claimType: Constants.NOTHING }); }
    });
  }

  /**
   * ...
   */
  getClaimType(sendClaim) {
    var options = ['chow1','chow2','chow3','pung','kong','win','nothing'];
    inquirer
    .prompt([{
      type: 'input',
      name: 'claimType',
      message: 'as what? [${options.join(",")}]:',
      validate: value => {
        if (options.indexOf(value.toLowerCase())===-1) return 'you need to pick one...';
        return true;
      }
    }])
    .then(answers => {
      var claimTypes = {
        chow1: Constants.CHOW1,
        chow2: Constants.CHOW2,
        chow3: Constants.CHOW3,
        pung: Constants.PUNG,
        kong: Constants.KONG,
        win: Constants.WIN,
        nothing: Constants.NOTHING
      }
      var claimType = claimTypes[answers.claimType];
      if (claimType === Constants.WIN) { this.getWinType(sendClaim); }
      else { sendClaim({ claimType }); }
    });
  }

  /**
   * ...
   */
  getWinType(sendClaim) {
    var wintypes = ['chow1','chow2','chow3','pung','pair','nothing'];
    inquirer
    .prompt([{
      type: 'input',
      name: 'winType',
      message: 'What are you winning on? [${wintypes.join(",")}]:',
      validate: value => {
        if (wintypes.indexOf(value.toLowerCase())===-1) return 'you need to pick one...';
        return true;
      }
    }])
    .then(answers => {
      var winTypes = {
        chow1: Constants.CHOW1,
        chow2: Constants.CHOW2,
        chow3: Constants.CHOW3,
        pair: Constants.PAIR,
        pung: Constants.PUNG,
        nothing: Constants.NOTHING
      }
      var winType = winTypes[answers.winType];
      if (winType === Constants.NOTHING) { sendClaim({ claimType: winType }); }
      else { sendClaim({ claimType: Constants.WIN, winType }); }
    });
  }

  /**
   * ...
   */
  recordReveal(playerPosition, tiles) {
    var player = this.players[playerPosition];
    console.log('${player.name} claimed the discard to form', tiles.map(tile => this.colorTile(Tiles.getShortForm(tile))).join(''));
    super.recordReveal(playerPosition, tiles);
  }

  /**
   * ...
   */
  recordBonus(playerPosition, tiles) {
    //var player = this.players[playerPosition];
    //console.log('${player.name} received bonus tile(s) ', tiles.map(tile => Tiles.getShortForm(tile)));
    super.recordBonus(playerPosition, tiles);
  }

  /**
   * ...
   */
  handDrawn(acknowledged) {
    inquirer
    .prompt([{
      type: 'input',
      name: 'acknowledge',
      message: 'Hand was a draw...'
    }])
    .then(answers => acknowledged());
  }

  /**
   * ...
   */
  handWon(winner, selfdrawn, acknowledged) {
    inquirer
    .prompt([{
      type: 'input',
      name: 'acknowledge',
      message: 'Hand was a won by ${Tiles.getPositionWind(winner)} player'
    }])
    .then(answers => acknowledged());
  }

  /**
   * ...
   */
  socketPreBindings() {
    super.socketPreBindings();
    // FIXME: TEMPORARY BUT NECESSARY DUE TO THE UNINTERRUPTIBILITY OF INQUIRER PROMISE
    this.connector.publish('disable-claim-timeout');
    // FIXME: TEMPORARY BUT NECESSARY DUE TO THE UNINTERRUPTIBILITY OF INQUIRER PROMISE
  }
};

module.exports = Client;
