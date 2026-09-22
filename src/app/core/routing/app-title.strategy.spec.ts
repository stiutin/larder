import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Meta, Title} from '@angular/platform-browser';
import {provideRouter, Router, TitleStrategy} from '@angular/router';

import {product} from '../../../testing/fixtures';
import {AppTitleStrategy} from './app-title.strategy';

@Component({template: ''})
class BlankComponent {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {component: BlankComponent, path: 'about', title: 'About us'},
          {
            component: BlankComponent,
            path: 'product/:id',
            resolve: {product: () => product(7, {title: 'Blue Kettle'})},
          },
        ]),
        {provide: TitleStrategy, useClass: AppTitleStrategy},
      ],
    });
  });

  it('uses the route title with the app name', async () => {
    await TestBed.inject(Router).navigateByUrl('/about');

    expect(TestBed.inject(Title).getTitle()).toBe('About us · Larder');
  });

  it('uses the resolved product for the title, description and Open Graph image', async () => {
    await TestBed.inject(Router).navigateByUrl('/product/7');
    const meta = TestBed.inject(Meta);

    expect(TestBed.inject(Title).getTitle()).toBe('Blue Kettle · Larder');
    expect(meta.getTag('property="og:title"')?.content).toBe('Blue Kettle · Larder');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://cdn.dummyjson.com/test/7.webp');
    expect(meta.getTag('name="description"')?.content).toBe('Description 7');
  });
});
