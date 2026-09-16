const NORMAL_TINT = 0x000000;
const ALERT_TINT = 0xffffff;

export function renderReport(viewModel, bindings) {
  for (const [fieldName, binding] of Object.entries(bindings)) {
    const field = viewModel[fieldName];
    if (!field) throw new TypeError(`Missing report field: ${fieldName}`);

    binding.label.text = field.text;

    if (binding.highlight) {
      const alert = field.alert === true;
      binding.label.tint = alert ? ALERT_TINT : NORMAL_TINT;
      binding.highlight.visible = alert;
      binding.highlight.width = Math.ceil(binding.label.width);
    }
  }
}
