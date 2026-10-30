import Icon from '../common/Icon.jsx';

export default function WhyOptimal({ explanation }) {
  return <section className="why-panel" id="why-optimal"><div className="why-title"><Icon name="check" size={18}/><h2>Mengapa Rute Ini Optimal?</h2></div><p>{explanation || 'Penjelasan akan tersedia setelah hasil optimizer dimuat.'}</p></section>;
}
