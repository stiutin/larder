import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {ContactResult, ContactService} from '../data/contact.service';
import {ContactComponent} from './contact.component';

async function setup(result: ContactResult | Error): Promise<{send: ReturnType<typeof vi.fn>}> {
  const send = vi.fn(async () => {
    if (result instanceof Error) {
      throw result;
    }

    return result;
  });
  await render(ContactComponent, {providers: [{provide: ContactService, useValue: {send}}]});

  return {send};
}

async function fillValidForm(): Promise<void> {
  await userEvent.type(screen.getByRole('textbox', {name: /^Name/}), 'Ada Lovelace');
  await userEvent.type(screen.getByRole('textbox', {name: /^Email/}), 'ada@example.com');
  await userEvent.selectOptions(screen.getByRole('combobox', {name: /^Topic/}), 'feedback');
  await userEvent.type(screen.getByRole('textbox', {name: /^Message/}), 'The offline cart is a lovely touch.');
}

describe('ContactComponent', () => {
  it('an empty submit shows errors, marks fields invalid and focuses the first one', async () => {
    const {send} = await setup('sent');

    await userEvent.click(screen.getByRole('button', {name: /Send/}));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText('Please tell us your name.')).toBeTruthy();
    const name = screen.getByRole('textbox', {name: /^Name/});
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(name);
  });

  it('rejects a malformed email', async () => {
    await setup('sent');

    await userEvent.type(screen.getByRole('textbox', {name: /^Email/}), 'not-an-email');
    await userEvent.tab();

    expect(screen.getByText(/Enter an email address/)).toBeTruthy();
  });

  it('sends a valid message and confirms delivery', async () => {
    const {send} = await setup('sent');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', {name: /Send/}));

    expect(send).toHaveBeenCalledWith({
      email: 'ada@example.com',
      message: 'The offline cart is a lovely touch.',
      name: 'Ada Lovelace',
      topic: 'feedback',
    });
    expect(await screen.findByText(/on its way/)).toBeTruthy();
  });

  it('offline: tells the user the message is saved on the device', async () => {
    await setup('queued');

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', {name: /Send/}));

    expect(await screen.findByText('Saved on this device.')).toBeTruthy();
  });

  it('keeps the text in the form when sending fails', async () => {
    await setup(new Error('boom'));

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', {name: /Send/}));

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    expect(screen.getByRole('textbox', {name: /^Name/})).toHaveProperty('value', 'Ada Lovelace');
  });
});
