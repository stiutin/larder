import {afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButton} from '@angular/material/button';

import {APP_NAME} from '../../../core/brand';
import {GITHUB_HANDLE, GITHUB_URL} from '../../../core/contact';
import {CONTACT_TOPICS, ContactResult, ContactService, ContactTopic} from '../data/contact.service';

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 1000;
const NAME_MAX = 80;
const FIELD_ORDER = ['name', 'email', 'topic', 'message'] as const;

export const TOPIC_LABELS: Record<ContactTopic, string> = {
  bug: 'Bug report',
  feedback: 'Feedback',
  general: 'General question',
  partnership: 'Partnership',
};

type SubmitState = 'error' | 'idle' | 'sending' | ContactResult;

interface Faq {
  answer: string;
  question: string;
}

/**
 * Prerendered at build time (SSG); the form becomes interactive after hydration.
 * Errors appear after a field is touched or on submit, and the first invalid field receives focus.
 */
@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
  imports: [MatButton, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  protected readonly appName = APP_NAME;
  protected readonly githubHandle = `@${GITHUB_HANDLE}`;
  protected readonly githubUrl = GITHUB_URL;
  protected readonly topics = CONTACT_TOPICS;
  protected readonly topicLabels = TOPIC_LABELS;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly messageMin = MESSAGE_MIN;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(MESSAGE_MIN), Validators.maxLength(MESSAGE_MAX)]],
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    topic: ['general' as ContactTopic, Validators.required],
  });

  /**
   * The page is prerendered. Until it hydrates, the fields are read-only: reactive forms write their (empty)
   * values into the inputs during hydration, so anything typed earlier would silently disappear.
   */
  protected readonly interactive = signal(false);
  protected readonly state = signal<SubmitState>('idle');
  protected readonly submitted = signal(false);
  protected readonly messageLength = toSignal(this.form.controls.message.valueChanges, {initialValue: ''});
  protected readonly remaining = computed(() => MESSAGE_MAX - this.messageLength().length);

  protected readonly faqs: Faq[] = [
    {
      answer: `No. ${APP_NAME} is a portfolio project: products come from a public demo API and no orders are placed.`,
      question: 'Can I actually buy something?',
    },
    {
      answer:
        'It goes to a mock endpoint that accepts the data and discards it. Nothing is stored and no one will email you.',
      question: 'What happens to my message?',
    },
    {
      answer:
        'Yes. Without a connection your message is saved on this device and sent automatically once you are back online.',
      question: 'Does the form work offline?',
    },
  ];

  private readonly contact = inject(ContactService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.interactive.set(true));
  }

  protected showError(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];

    return field.invalid && (field.touched || this.submitted());
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Not `[aria-invalid="true"]`: that attribute is only updated on the next change detection,
      // so right now it would still point at nothing. The control state is already correct.
      const firstInvalid = FIELD_ORDER.find((field) => this.form.controls[field].invalid);
      this.host.nativeElement.querySelector<HTMLElement>(`[formControlName="${firstInvalid}"]`)?.focus();

      return;
    }

    this.state.set('sending');

    try {
      this.state.set(await this.contact.send(this.form.getRawValue()));
      this.form.reset();
      this.submitted.set(false);
    } catch {
      this.state.set('error');
    }
  }

  protected startOver(): void {
    this.state.set('idle');
  }
}
