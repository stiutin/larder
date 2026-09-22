import {makeStateKey} from '@angular/core';
import {EntityState} from '@ngrx/signals/entities';

import {Product} from '../../../shared/model/product.model';
import {CatalogState} from './catalog.state';

/**
 * Server → client hand-off of the catalogue state.
 *
 * Without it the client store starts empty, the first client render shows a skeleton over the server's list,
 * the markup diverges and the page flickers. The server puts the loaded state into TransferState;
 * the client store starts from it and also writes the page to IndexedDB, so it works offline after one SSR visit.
 */
export type CatalogSnapshot = CatalogState & EntityState<Product>;

export const CATALOG_TRANSFER_KEY = makeStateKey<CatalogSnapshot>('catalog-state');
