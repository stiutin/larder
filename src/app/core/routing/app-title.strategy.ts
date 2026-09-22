import {inject, Injectable} from '@angular/core';
import {Meta, Title} from '@angular/platform-browser';
import {ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy} from '@angular/router';

import {APP_NAME} from '../brand';
import {SITE_URL} from '../http/api.config';

const DEFAULT_DESCRIPTION =
  'A product catalogue that works offline: browse, search and fill your cart without a connection.';
const DESCRIPTION_LIMIT = 160;

interface ResolvedProduct {
  description: string;
  thumbnail: string;
  title: string;
}

function isResolvedProduct(value: unknown): value is ResolvedProduct {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ResolvedProduct>;

  return typeof candidate.title === 'string' && typeof candidate.description === 'string';
}

function deepestChild(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? deepestChild(snapshot.firstChild) : snapshot;
}

/**
 * Title and meta tags come from already resolved route data.
 * A separate title resolver would fetch the same product a second time.
 * On the server this gives crawlers and link previews the real product name, description and image.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly siteUrl = inject(SITE_URL, {optional: true}) ?? '';
  private currentUrl = '/';

  public override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentUrl = snapshot.url;
    const resolved: unknown = deepestChild(snapshot.root).data.product;
    const routeTitle = this.buildTitle(snapshot);

    if (isResolvedProduct(resolved)) {
      this.apply(`${resolved.title} · ${APP_NAME}`, resolved.description, resolved.thumbnail);

      return;
    }

    this.apply(routeTitle ? `${routeTitle} · ${APP_NAME}` : APP_NAME, DEFAULT_DESCRIPTION, null);
  }

  private apply(title: string, description: string, image: string | null): void {
    const shortDescription = description.slice(0, DESCRIPTION_LIMIT);

    this.title.setTitle(title);
    this.meta.updateTag({content: shortDescription, name: 'description'});
    this.meta.updateTag({content: title, property: 'og:title'});
    this.meta.updateTag({content: shortDescription, property: 'og:description'});
    this.meta.updateTag({content: image ?? `${this.siteUrl}/assets/brand/og-image.png`, property: 'og:image'});

    if (this.siteUrl) {
      this.meta.updateTag({content: `${this.siteUrl}${this.currentUrl}`, property: 'og:url'});
    }
  }
}
