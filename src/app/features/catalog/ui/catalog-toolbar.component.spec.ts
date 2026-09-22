import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {query} from '../../../../testing/fixtures';
import {CatalogToolbarComponent} from './catalog-toolbar.component';

const categories = [
  {name: 'Laptops', slug: 'laptops'},
  {name: 'Smartphones', slug: 'smartphones'},
];

describe('CatalogToolbarComponent', () => {
  it('debounces typing: one search event with the trimmed final value', async () => {
    const searchChange = vi.fn();
    await render(CatalogToolbarComponent, {inputs: {categories, query: query()}, on: {searchChange}});

    await userEvent.type(screen.getByRole('searchbox', {name: /Search/}), '  phone ');
    expect(searchChange).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(searchChange).toHaveBeenCalledTimes(1), {timeout: 1000});
    expect(searchChange).toHaveBeenCalledWith('phone');
  });

  it('emits category and sort changes', async () => {
    const categoryChange = vi.fn();
    const sortChange = vi.fn();
    await render(CatalogToolbarComponent, {inputs: {categories, query: query()}, on: {categoryChange, sortChange}});

    await userEvent.selectOptions(screen.getByRole('combobox', {name: /Category/}), 'laptops');
    await userEvent.selectOptions(screen.getByRole('combobox', {name: /Sort/}), 'price-asc');

    expect(categoryChange).toHaveBeenCalledWith('laptops');
    expect(sortChange).toHaveBeenCalledWith('price-asc');
  });

  it('disables the category filter while searching and explains why', async () => {
    await render(CatalogToolbarComponent, {inputs: {categories, query: query({search: 'phone'})}});

    expect(screen.getByRole('combobox', {name: /Category/})).toHaveProperty('disabled', true);
    expect(screen.getByText(/cannot search within a category/i)).toBeTruthy();
  });

  it('renders values as attributes (hydration-safe) and follows external URL changes', async () => {
    const {rerender} = await render(CatalogToolbarComponent, {
      inputs: {categories, query: query({search: 'phone', sort: 'price-asc'})},
    });
    const search = screen.getByRole('searchbox', {name: /Search/});

    // An attribute, not a property binding: hydration must not overwrite text typed before the JS arrived.
    expect(search.getAttribute('value')).toBe('phone');

    // Back button / "clear filters": the URL changes and the fields follow.
    await rerender({inputs: {categories, query: query({category: 'laptops'})}, partialUpdate: true});

    expect(search).toHaveProperty('value', '');
    expect(screen.getByRole('combobox', {name: /Category/})).toHaveProperty('value', 'laptops');
    expect(screen.getByRole('combobox', {name: /Sort/})).toHaveProperty('value', 'relevance');
  });
});
