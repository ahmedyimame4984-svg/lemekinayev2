import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminSavedViewsToolbar } from './admin-saved-views-toolbar';

describe('AdminSavedViewsToolbar', () => {
  it('keeps Save as new actionable when the view name is empty so validation can explain what is required', () => {
    const markup = renderToStaticMarkup(
      <AdminSavedViewsToolbar
        idPrefix="product-types"
        savedViews={[]}
        loading={false}
        saving={false}
        selectedId=""
        name=""
        namePlaceholder="Draft brake parts"
        error=""
        onSelect={vi.fn()}
        onNameChange={vi.fn()}
        onSaveAsNew={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(markup).toContain('View name (required)');
    expect(markup).toContain('placeholder="Enter a name, e.g. Draft brake parts"');

    const saveButton = markup.match(/<button[^>]*>Save as new<\/button>/u)?.[0];
    expect(saveButton).toBeDefined();
    expect(saveButton).not.toContain('disabled');
  });
});
