// @flow
import {registerPlugin} from 'playkit-js'
import Comscore from './comscore'

declare var __VERSION__: string;
declare var __NAME__: string;

export default Comscore;
export {__VERSION__ as VERSION, __NAME__ as NAME};

const pluginName: string = "comscore";

registerPlugin(pluginName, Comscore);
