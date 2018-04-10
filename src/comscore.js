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
  _gPlugin: Object;
  _lastPosition: Number;
  _assetPartNumber: Number;

  static COMSCORE_LIB: string = "http://localhost:9002/build/src/streamsense.plugin.js";

  static PLUGIN_VERSION = "2.0";
  static PLUGIN_PLATFORM_NAME = "kaltura";

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

    this._trackEventMonitorCallbackName = config.trackEventMonitor;

    this._init();

    this._assetPartNumber = 1;

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
    this.player.ready().then(() => {
      this.logger.debug("The comScore onReady event was triggered.");

      let pluginConfig = this._parsePluginConfig(this.config);

      this._gPlugin = new ns_.StreamingAnalytics.Plugin(pluginConfig, Comscore.PLUGIN_PLATFORM_NAME, Comscore.PLUGIN_VERSION, window.KalturaPlayer.VERSION, {
        position: this._getCurrentPosition.bind(this),
        // preMeasurement: function (currentState, newEvent) {
        //   var apiCallName = 'notify' + eventTypeToAPICallMapping[newEvent];
        //
        //   trackEventMonitorLoggingNotify(apiCallName, getCurrentPosition());
        //
        //   return true;
        // }
      });
    });

    this._addBindings();
  }

  _getCurrentPosition(): void {
    return  Math.floor(this.player.currentTime * 1000);
  }

  _addBindings(): void {
    this.eventManager.listen(this.player, this.player.Event.SOURCE_SELECTED, () => this._onSourceSelected());
    this.eventManager.listen(this.player, this.player.Event.ERROR, (event) => this._onError(event));

    this.eventManager.listen(this.player, this.player.Event.FIRST_PLAY, () => this._onFirstPlay());
    this.eventManager.listen(this.player, this.player.Event.PLAYING, () => this._onPlaying());
    this.eventManager.listen(this.player, this.player.Event.SEEKING, () => this._onSeeking());
    this.eventManager.listen(this.player, this.player.Event.PAUSE, () => this._onPause());
    this.eventManager.listen(this.player, this.player.Event.ENDED, () => this._onEnded());
    this.eventManager.listen(this.player, this.player.Event.TIME_UPDATE, () => this._onTimeUpdate());

    this.eventManager.listen(this.player, this.player.Event.VIDEO_TRACK_CHANGED, (event) => this._onVideoTrackChanged(event));
    this.eventManager.listen(this.player, this.player.Event.AUDIO_TRACK_CHANGED, (event) => this._onAudioTrackChanged(event));
    this.eventManager.listen(this.player, this.player.Event.TEXT_TRACK_CHANGED, (event) => this._onTextTrackChanged(event));
    this.eventManager.listen(this.player, this.player.Event.PLAYER_STATE_CHANGED, (event) => this._onPlayerStateChanged(event));

    this.eventManager.listen(this.player, this.player.Event.AD_LOADED, (event) => this._onAdLoaded(event));
    this.eventManager.listen(this.player, this.player.Event.AD_STARTED, (event) => this._onAdStarted(event));
    this.eventManager.listen(this.player, this.player.Event.AD_RESUMED, (event) => this._onAdResumed(event));
    this.eventManager.listen(this.player, this.player.Event.AD_PAUSED, (event) => this._onAdPaused(event));
    this.eventManager.listen(this.player, this.player.Event.AD_CLICKED, (event) => this._onAdClicked(event));
    this.eventManager.listen(this.player, this.player.Event.AD_SKIPPED, (event) => this._onAdSkipped(event));
    this.eventManager.listen(this.player, this.player.Event.AD_COMPLETED, (event) => this._onAdCompleted(event));
    this.eventManager.listen(this.player, this.player.Event.AD_ERROR, (event) => this._onAdError(event));
    this.eventManager.listen(this.player, this.player.Event.ALL_ADS_COMPLETED, (event) => this._onAllAdsCompleted(event));
    this.eventManager.listen(this.player, this.player.Event.AD_BREAK_START, (event) => this._onAdBreakStart(event));
    this.eventManager.listen(this.player, this.player.Event.AD_BREAK_END, (event) => this._onAdBreakEnd(event));
    this.eventManager.listen(this.player, this.player.Event.AD_FIRST_QUARTILE, (event) => this._onAdFirstQuartile(event));
    this.eventManager.listen(this.player, this.player.Event.AD_MIDPOINT, (event) => this._onAdMidpoint(event));
    this.eventManager.listen(this.player, this.player.Event.AD_THIRD_QUARTILE, (event) => this._onAdThirdQuartile(event));
    this.eventManager.listen(this.player, this.player.Event.USER_CLOSED_AD, (event) => this._onUserClosedAd(event));
    this.eventManager.listen(this.player, this.player.Event.AD_VOLUME_CHANGED, (event) => this._onAdVolumeChanged(event));
    this.eventManager.listen(this.player, this.player.Event.AD_MUTED, (event) => this._onAdMuted(event));
    this.eventManager.listen(this.player, this.player.Event.AD_PROGRESS, (event) => this._onAdProgress(event));
  }

  _onError(event: ErrorEvent): void {
    //TODO: Check if error is critical and if so send ended
  }

  _onAdLoaded(event): void {
    this._log("_onAdLoaded", event);
  }
  _onAdStarted(event): void {
    this._log("_onAdStarted", event);
  }
  _onAdResumed(event): void {
    this._log("_onAdResumed", event);
  }
  _onAdPaused(event): void {
    this._log("_onAdPaused", event);
  }
  _onAdClicked(event): void {
    this._log("_onAdClicked", event);
  }
  _onAdSkipped(event): void {
    this._log("_onAdSkipped", event);
  }
  _onAdCompleted(event): void {
    this._log("_onAdCompleted", event);
  }
  _onAdError(event): void {
    this._log("_onAdError", event);
  }
  _onAllAdsCompleted(event): void {
    this._log("_onAllAdsCompleted", event);
  }
  _onAdBreakStart(event): void {
    this._log("_onAdBreakStart", event);
  }
  _onAdBreakEnd(event): void {
    this._log("_onAdBreakEnd", event);
  }
  _onUserClosedAd(event): void {
    this._log("_onUserClosedAd", event);
  }
  _onAdVolumeChanged(event): void {
    this._log("_onAdVolumeChanged", event);
  }
  _onAdMuted(event): void {
    this._log("_onAdMuted", event);
  }
  _onAdProgress(event): void {
    this._log("_onAdProgress", event);
  }

  _onVideoTrackChanged(event): void {
    // TODO
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
    this._log("Seeking from", this._lastPosition, "to", this._getCurrentPosition());

    this._sendCommand("notifySeekStart", this._lastPosition);
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

  _onTimeUpdate(): void {
    this._log("comscore", "_onTimeUpdate", this._getCurrentPosition());

    this._lastPosition = this._getCurrentPosition();
  }

  _isComscoreLoaded(): boolean {
    return window.ns_;
  }

  _onSourceSelected(): void {
    this._changeAsset()
  }

  _sendCommand(notifyCommandName: string, position: string): void {
    this.logger.debug("Going to send:" + notifyCommandName + "  with position:" + position);

    try {
      this._gPlugin[notifyCommandName](position);
    } catch(e){
      this.logger.error("Error occur while trying to send:" + notifyCommandName +" to comscore",e);
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

  _changeAsset(): void {
    this._gPlugin.createPlaybackSession();
    this._gPlugin.setAsset(this._getAssetMetadataLabels(), false, this._getAssetMetadataObjects());
  }

  _getAssetMetadataLabels(mediaMetadata): Object {
    var assetMetadataLabels = {};

    // // Audio is not tested.
    // assetMetadataLabels.ns_st_ty = playerAPIHelpers.isAudio() ? "audio" : 'audio';

    assetMetadataLabels.ns_st_pl = mediaMetadata.name;
    assetMetadataLabels.ns_st_pr = mediaMetadata.name;
    assetMetadataLabels.ns_st_ep = mediaMetadata.name;

    if (this.player.isLive()) {
      assetMetadataLabels.ns_st_li = "1";
    }

    // // Audio only Ads needs to be tested.
    // if (isAd) {
    //   // assetMetadataLabels.ns_st_ci = adInfo.adId;
    //   // assetMetadataLabels.ns_st_pn = "1"; // Current part number of the ad. Always assume part 1.
    //   // assetMetadataLabels.ns_st_tp = "1"; // Always assume ads have a total // Playlist title. of 1 parts.
    //   // assetMetadataLabels.ns_st_cl = Math.floor(adInfo.adDuration * 1000); // Length of the ad in milliseconds.
    //   //
    //   // assetMetadataLabels.ns_st_an = adNumber + "";
    //   //
    //   // if (adInfo.adType == 'preroll') {
    //   //   assetMetadataLabels.ns_st_ad = "pre-roll";
    //   //   assetMetadataLabels.ns_st_ct = "va11";
    //   // } else if (adInfo.adType == 'postroll') {
    //   //   assetMetadataLabels.ns_st_ad = "post-roll";
    //   //   assetMetadataLabels.ns_st_ct = "va13";
    //   // } else if (adInfo.adType == 'midroll') {
    //   //   assetMetadataLabels.ns_st_ad = "mid-roll";
    //   //   assetMetadataLabels.ns_st_ct = "va12";
    //   // } else {
    //   //   // This should never happen.
    //   //   assetMetadataLabels.ns_st_ad = 1;
    //   // }
    //   //
    //   // if(adInfo.adSystem)
    //   //   assetMetadataLabels.ns_st_ams = adInfo.adSystem.toLowerCase();
    //   //
    //   // if (adInfo.adTitle)
    //   //   assetMetadataLabels.ns_st_amt = adInfo.adTitle;
    //
    // } else {

      // //It might not have the final value at this point (0x0 instead)
      // if (mediaProxyEntry.width && mediaProxyEntry.height)
      //   assetMetadataLabels.ns_st_cs = mediaProxyEntry.width + "x" + mediaProxyEntry.height;
      // else
      //   assetMetadataLabels.ns_st_cs = "0x0";
      //
      // if (mediaProxyEntry.downloadUrl)
      //   assetMetadataLabels.ns_st_cu = mediaProxyEntry.downloadUrl;

      assetMetadataLabels.ns_st_cl = mediaMetadata.duration; // or .duration in seconds
      assetMetadataLabels.ns_st_ci = mediaMetadata.id;
      assetMetadataLabels.ns_st_pn = this._assetPartNumber + "";
      assetMetadataLabels.ns_st_tp = "0";
      assetMetadataLabels.ns_st_ct = "vc00"; //TODO when knowing the total parts?

      assetMetadataLabels.ns_st_ct = this.player.config.type == 'Audio' ? "ac00" : "vc00";
    // }

    return {}; // TODO
  }

  _getAssetMetadataObjects(): Object {
    return [
      {
        prefix: '',
        map: this.player.config.metadata
      },
      {
        prefix: 'content',
        map: this.player.config
      },
      {
        prefix: 'content.session',
        map: this.player.config.session
      },
      {
        prefix: 'content.playback',
        map: this.player.config.playback
      }
    ];
  }

  /**
   * Prepares the object to be consumed by the comScore Generic Plugin Library.
   * @private
   * @param {object} pluginConfig - Plugin configuration object.
   * @returns {object} The object to be consumed by the comScore Generic Plugin library.
   * */
  _parsePluginConfig(pluginConfig): Object {
    pluginConfig = pluginConfig || {};

    let comScorePlugin = {
      publisherId: this.player.config.session && this.player.config.session.partnerId || pluginConfig.publisherId,
      debug: pluginConfig.debug || true
    };

    return comScorePlugin;
  }

  _log(): void {
    const args = Array.from(arguments);
    args.unshift("comScore plugin:");

    this.logger.debug.apply(this.logger, args);
    // this.logger.debug("The comScore onReady event was triggered.");
  }
}
