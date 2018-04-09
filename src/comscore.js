// @flow
import {BasePlugin} from 'playkit-js'
import {Utils} from 'playkit-js'
import ns_ from "../bin/streamsense.plugin.min.js"

/**
 * Your class description.
 * @classdesc
 */
export default class Comscore extends BasePlugin {


  _streamingAnalytics: any;
  _trackEventMonitorCallbackName: string;
  labels: Object;
  _isBuffering: boolean;

  loadPromise: DeferredPromise;
  static COMSCORE_LIB: string = "http://localhost:9001/build/bin/comscore.min.js";




  static PLUGIN_VERSION = "2.0";
  static PLUGIN_PLATFORM_NAME = "kaltura";
  /**
   * TODO: Override and define your default configuration for the plugin.
   * The default configuration of the plugin.
   * @type {Object}
   * @static
   */
  static defaultConfig: Object = {
    libURL:Comscore.COMSCORE_LIB
  };

  /**
   * TODO: Define under what conditions the plugin is valid.
   * @static
   * @public
   * @returns {boolean} - Whether the plugin is valid.
   */
  static isValid(): boolean {
    return true;
  }

  /**
   * @constructor
   * @param {string} name - The plugin name.
   * @param {Player} player - The player instance.
   * @param {Object} config - The plugin config.
   */
  constructor(name: string, player: Player, config: Object) {
    super(name, player, config);
    let pluginOptions = config;
    this._trackEventMonitorCallbackName = config.trackEventMonitor;
    this._init();

    this._addBindings();

    /**
     Now you have access to the BasePlugin members:
     1. config: The runtime configuration of the plugin.
     2. name: The name of the plugin.
     3. logger: The logger of the plugin.
     4. player: Reference to the actual player.
     5. eventManager: The event manager of the plugin.
    */
  }

  /**
   * Initializing the plugin.
   * @private
   * @returns {void}
   */
  _init(): void {
    this._streamingAnalytics = new ns_.StreamingAnalytics({
      publisherId: "123456",
      debug: true
    });
    // this.loadPromise = Utils.Object.defer();
    // (this._isComscoreLoaded()
    //   ? Promise.resolve()
    //   : Utils.Dom.loadScriptAsync(this.config.libURL))
    //   .then(() => {
    //     this._streamingAnalytics = new ns_.StreamingAnalytics();
    //     this._updateLabels();
    //     this.loadPromise.resolve();
    //   })
    //   .catch((e) => {
    //     this.loadPromise.reject(e);
    //   });
    // return this.loadPromise;
  }

  _addBindings(): void {
    this.eventManager.listen(this.player, this.player.Event.SOURCE_SELECTED, () => this._onSourceSelected());
    this.eventManager.listen(this.player, this.player.Event.ERROR, (event) => this._onError(event));
    this.player.ready().then(() => {
      this.eventManager.listen(this.player, this.player.Event.PLAYING, () => this._onPlaying());
      this.eventManager.listen(this.player, this.player.Event.FIRST_PLAY, () => this._onFirstPlay());
      this.eventManager.listen(this.player, this.player.Event.SEEKING, () => this._onSeeking());
      this.eventManager.listen(this.player, this.player.Event.PAUSE, () => this._onPause());
      this.eventManager.listen(this.player, this.player.Event.ENDED, () => this._onEnded());
      this.eventManager.listen(this.player, this.player.Event.TIME_UPDATE, () => this._onTimeUpdate());
      this.eventManager.listen(this.player, this.player.Event.VIDEO_TRACK_CHANGED, (event) => this._onVideoTrackChanged(event));
      this.eventManager.listen(this.player, this.player.Event.ABR_MODE_CHANGED, (event) => this._onAbrModeChanged(event));
      this.eventManager.listen(this.player, this.player.Event.AUDIO_TRACK_CHANGED, (event) => this._onAudioTrackChanged(event));
      this.eventManager.listen(this.player, this.player.Event.TEXT_TRACK_CHANGED, (event) => this._onTextTrackChanged(event));
      this.eventManager.listen(this.player, this.player.Event.PLAYER_STATE_CHANGED, (event) => this._onPlayerStateChanged(event));
      this.eventManager.listen(this.player, this.player.Event.AD_LOADED, (event) => this._onAdLoaded(event));
      this.eventManager.listen(this.player, this.player.Event.AD_STARTED, (event) => this._onAdStarted(event));
      this.eventManager.listen(this.player, this.player.Event.AD_BREAK_END, (event) => this._onAdEneded(event));
    });
  }

  _onError(event: ErrorEvent): void {
    //TODO: Check if error is critical and if so send ended
  }

  _onAdLoaded(event: AdEvent): void{
    //TODO load metadata for Ad
  }
  _onAdStarted(): void{
    this._sendCommand("notifyPlay",0);
  }

  _onAdEneded(): void {
    this._sendCommand("notifyEnd");
  }


  _onPlayerStateChanged(event: FakeEvent): void {
    const oldState = event.payload.oldState;
    const newState = event.payload.newState;
    if (oldState.type === this.player.State.BUFFERING) {
      this._isBuffering = false;
      this._sendCommand("notifyBufferStop");
    }
    if (newState.type === this.player.State.BUFFERING) {
      this._isBuffering = true;
      this._sendCommand("notifyBufferStart");
    }
  }

  _onSeeking(): void {
    this._sendCommand("notifySeekStart");
  }

  _onPlaying(): void{
      this._sendCommand("notifyPlay");
  }

  _onFirstPlay(): void {
    this._sendCommand('notifyPlay');
}

  _onEnded(): void {
    this._sendCommand("notifyEnd");
  }

  _onPause(): void{
    this._sendCommand("notifyPause");
  }

  _updateLabels(): void{
    this.labels[comscoreLabels.PLAYER_NAME] = Comscore.PLUGIN_PLATFORM_NAME;
    // this.labels[comscoreLabels.PLAYER_VERSION] = this.player.VERSION
    this._streamingAnalytics.getPlaybackSession().setLabels(this.labels);
  }

  _isComscoreLoaded(): boolean {
    return window.ns_;
  }

  _onSourceSelected(): void {
    this._streamingAnalytics.createPlaybackSession();
  }

  _sendCommand(command: string, argument: string): void {
    this.logger.debug("Going to send:" + command + "  with args:" + argument);
    // if (argument == undefined &&  !this.player.isLive() ){
    //     argument = this.player.currentTime() * 1000;
    // }
    try {
      this._streamingAnalytics[command](argument);
    } catch(e){
      this.logger.error("Error occur while trying to send:" + command +" to comscore",e);
    }
  }

  /**
   * TODO: Define the destroy logic of your plugin.
   * Destroys the plugin.
   * @override
   * @public
   * @returns {void}
   */
  destroy(): void {
    this.eventManager.destroy();
  }

  /**
   * TODO: Define the reset logic of your plugin.
   * Resets the plugin.
   * @override
   * @public
   * @returns {void}
   */
  reset(): void {
  // Write logic
  }
}
