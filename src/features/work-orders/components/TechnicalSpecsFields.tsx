/**
 * Objetivo: características técnicas DETALLADAS del equipo, todas opcionales.
 * Agrupa los campos del catálogo del tipo de equipo (Procesador, Memoria RAM,
 * Almacenamiento…), usa listas para valores estandarizados (DDR4, SSD NVMe…),
 * muestra la unidad en la etiqueta y permite agregar especificaciones
 * adicionales libres (nombre → valor) para lo que no esté en el catálogo.
 */
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { MAX_EXTRA_SPECS, type EquipmentType, type SpecField } from '../../../api/types';
import { Input, Select, Textarea } from '../../../components/ui/FormField';
import type { NewWorkOrderFormValues } from '../schemas';

interface Props {
  type: EquipmentType;
  register: UseFormRegister<NewWorkOrderFormValues>;
  control: Control<NewWorkOrderFormValues>;
  errors: FieldErrors<NewWorkOrderFormValues>;
}

const fieldLabel = (field: SpecField) => (field.unit ? `${field.label} (${field.unit})` : field.label);

/** Agrupa conservando el orden del catálogo; los campos sin grupo van primero. */
const groupFields = (fields: SpecField[]) => {
  const groups = new Map<string, SpecField[]>();
  fields.forEach((field) => {
    const name = field.group ?? '';
    groups.set(name, [...(groups.get(name) ?? []), field]);
  });
  return [...groups.entries()];
};

export function TechnicalSpecsFields({ type, register, control, errors }: Props) {
  const extras = useFieldArray({ control, name: 'extraSpecs' });
  const fields = type.specSchema.filter((field) => !field.legacy);
  const specErrors = errors.equipment?.technicalSpecs as Record<string, { message?: string }> | undefined;

  const renderField = (field: SpecField) => {
    const common = {
      label: fieldLabel(field),
      placeholder: field.placeholder,
      hint: field.hint,
      error: specErrors?.[field.key]?.message,
      ...register(`equipment.technicalSpecs.${field.key}`),
    };
    switch (field.type) {
      case 'select':
        return <Select key={field.key} {...common} placeholder="No indicado" options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />;
      case 'textarea':
        return <Textarea key={field.key} {...common} />;
      case 'number':
        return <Input key={field.key} {...common} type="number" inputMode="decimal" step="any" min={field.min} max={field.max} />;
      default:
        return <Input key={field.key} {...common} />;
    }
  };

  return (
    <>
      <h3 className="subheading">Características técnicas ({type.name})</h3>
      <p className="hint">Todas son opcionales: complete las que pueda verificar al recibir el equipo.</p>
      {groupFields(fields).map(([group, groupFields]) => (
        <fieldset key={group || 'general'} className="spec-group">
          {group && <legend>{group}</legend>}
          <div className="grid-3">{groupFields.map(renderField)}</div>
        </fieldset>
      ))}

      <fieldset className="spec-group">
        <legend>Especificaciones adicionales</legend>
        {extras.fields.length === 0 && <p className="hint">¿Algo que no esté en la lista? Agréguelo aquí (p. ej. lector de huella, teclado retroiluminado).</p>}
        {extras.fields.map((item, index) => (
          <div className="extra-spec-row" key={item.id}>
            <Input
              label="Especificación"
              placeholder="Ej.: Lector de huella"
              error={errors.extraSpecs?.[index]?.name?.message}
              {...register(`extraSpecs.${index}.name`)}
            />
            <Input
              label="Valor"
              placeholder="Ej.: Sí, funciona"
              error={errors.extraSpecs?.[index]?.value?.message}
              {...register(`extraSpecs.${index}.value`)}
            />
            <button type="button" className="icon-btn" aria-label="Quitar especificación" onClick={() => extras.remove(index)}>
              ×
            </button>
          </div>
        ))}
        {extras.fields.length < MAX_EXTRA_SPECS && (
          <button type="button" className="chip" onClick={() => extras.append({ name: '', value: '' })}>
            + Agregar especificación
          </button>
        )}
      </fieldset>
    </>
  );
}
