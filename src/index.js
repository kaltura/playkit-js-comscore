// @flow
import {registerPlugin} from '@playkit-js/playkit-js';
import Comscore from './comscore';

declare var __VERSION__: string;
declare var __NAME__: string;

const VERSION = __VERSION__;
const NAME = __NAME__;

export default Comscore;
export {VERSION, NAME};

const pluginName: string = 'comscore';

registerPlugin(pluginName, Comscore);
