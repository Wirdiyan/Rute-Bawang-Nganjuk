import Icon from '../common/Icon.jsx';
import { optimalExplanation } from '../../data/mockData.js';

export default function WhyOptimal() {
  return <section className="why-panel" id="why-optimal"><div className="why-title"><Icon name="check" size={18}/><h2>Mengapa Rute Ini Optimal?</h2></div><p>{optimalExplanation}</p></section>;
}
