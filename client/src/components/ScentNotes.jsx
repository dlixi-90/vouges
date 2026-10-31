import { scentPhases } from '../utils/scentNotes';

function Notes({ notes = {} }) {
  const phases = scentPhases.filter(([phase]) => notes[phase]?.length > 0);
  if (!phases.length) return null;
  return <div className="product-description-notes my-6 grid gap-5 sm:grid-cols-3">
    {phases.map(([phase, label]) => <div className={`rounded-lg border border-gray-200 p-5 ${phase === 'general' ? 'sm:col-span-3' : ''}`} key={phase}>
      <h3 className="mb-3 text-xl">{label}</h3>
      <p className="text-sm leading-7 text-gray-600">{notes[phase].map(note => note.name).join(', ')}</p>
    </div>)}
  </div>;
}

export default function ScentNotes({ fragrance = {} }) {
  const assortment = fragrance.profileKind === 'assortment';
  const groups = assortment
    ? [...new Set((fragrance.components || []).map(component => component.variantKey))].map(key => ({
      key, label: fragrance.components.find(component => component.variantKey === key)?.optionName || key,
      components: fragrance.components.filter(component => component.variantKey === key),
    }))
    : [{ key: 'bundle', components: fragrance.components || [] }];
  return <>
    <Notes notes={fragrance.notes} />
    {fragrance.components?.length > 0 && <section className="my-8" aria-label="Mùi hương theo từng sản phẩm">
      <h2 className="mb-5 text-xl">{assortment ? 'Mùi hương theo lựa chọn' : 'Mùi hương trong bộ sản phẩm'}</h2>
      {assortment && <p className="mb-5 text-sm text-gray-600">Mỗi lựa chọn là một set riêng. Xem các chai nước hoa đi kèm từng set dưới đây.</p>}
      {fragrance.compositionNote && <p className="mb-5 text-sm leading-7 text-gray-600">{fragrance.compositionNote}</p>}
      {groups.map(group => <section key={group.key} className={assortment ? 'mb-8 rounded-lg border border-gray-200 p-5' : ''}>
        {group.label && <h3 className="mb-5 text-lg font-medium">{group.label}</h3>}
        {group.components.map((component, index) => <section className="mb-6 last:mb-0" key={`${component.name}:${index}`}>
        {assortment ? <h4 className="text-base font-medium">{component.name}</h4> : <h3 className="text-lg font-medium">{component.name}</h3>}
        {component.contents && <p className="mt-2 text-sm text-gray-600">{component.contents}</p>}
        {[component.concentration, component.group].filter(Boolean).length > 0 && <p className="mt-2 text-sm text-gray-600">{[component.concentration, component.group].filter(Boolean).join(' · ')}</p>}
        <Notes notes={component.notes} />
        </section>)}
      </section>)}
    </section>}
  </>;
}
