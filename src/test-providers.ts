import {provideZonelessChangeDetection} from '@angular/core';

// Specs run zoneless, exactly like the application.
export default [provideZonelessChangeDetection()];
