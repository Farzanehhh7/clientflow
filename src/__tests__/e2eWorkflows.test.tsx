import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from '../components/Modal';
import { CustomersPage } from '../pages/CustomersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ClientFlowProvider, useClientFlow } from '../store/useClientFlowStore';
import { hasConflict } from '../utils/overlap';

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('E2E User Journey Scenarios (Testing Library)', () => {
  it('Scenario 1: Create & search a new customer via CustomersPage workflow', async () => {
    render(
      <ClientFlowProvider>
        <CustomersPage />
      </ClientFlowProvider>,
    );

    const newBtn = screen.getByRole('button', { name: /مراجع \/ بیمار جدید|مشتری جدید/ });
    fireEvent.click(newBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const nameInput = screen.getByLabelText(/نام و نام خانوادگی/);
    fireEvent.change(nameInput, { target: { value: 'کیانا سپهری' } });

    const phoneInput = screen.getByPlaceholderText('09120000000');
    fireEvent.change(phoneInput, { target: { value: '09127654321' } });

    const submitBtn = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('کیانا سپهری')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('جستجوی مشتریان');
    fireEvent.change(searchInput, { target: { value: 'کیانا' } });

    await waitFor(() => {
      expect(screen.getByText('کیانا سپهری')).toBeInTheDocument();
    });
  });

  it('Scenario 2: Modal keyboard accessibility (Escape closes dialog)', () => {
    let closed = false;
    render(
      <Modal open={true} onClose={() => { closed = true; }} title="مدال تست دسترسی‌پذیری">
        <p>محتوای دیالوگ</p>
      </Modal>,
    );

    const dlg = screen.getByRole('dialog', { name: 'مدال تست دسترسی‌پذیری' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('Scenario 3: Industry Pack switching preserves existing customer records', async () => {
    function PackSwitchHarness() {
      const { state, addCustomer, applyIndustryPack } = useClientFlow();
      return (
        <div>
          <span data-testid="pack">{state.settings.industryPack}</span>
          <span data-testid="count">{state.customers.length}</span>
          <button
            type="button"
            onClick={() =>
              addCustomer({
                name: 'مشتری ماندگار',
                phone: '09125551122',
                tags: ['ویژه'],
              })
            }
          >
            AddCustomer
          </button>
          <button type="button" onClick={() => applyIndustryPack('restaurant')}>
            SwitchToRestaurant
          </button>
        </div>
      );
    }

    render(
      <ClientFlowProvider>
        <PackSwitchHarness />
      </ClientFlowProvider>,
    );

    const initialCount = Number(screen.getByTestId('count').textContent);
    fireEvent.click(screen.getByRole('button', { name: 'AddCustomer' }));

    await waitFor(() => {
      expect(Number(screen.getByTestId('count').textContent)).toBe(initialCount + 1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'SwitchToRestaurant' }));

    await waitFor(() => {
      expect(screen.getByTestId('pack').textContent).toBe('restaurant');
      // Existing customers must NOT be lost after switching pack
      expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThanOrEqual(initialCount + 1);
    });
  });

  it('Scenario 4: Appointment booking conflict guard blocks overlapping resource slots', () => {
    function BookingHarness() {
      const { state } = useClientFlow();
      const firstApt = state.appointments[0];
      const conflictDetected = firstApt
        ? hasConflict(
            state.appointments,
            {
              resourceId: firstApt.resourceId,
              serviceId: firstApt.serviceId,
              start: firstApt.start,
              end: firstApt.end,
            },
            state.services,
          )
        : false;
      return <div data-testid="conflict">{String(conflictDetected)}</div>;
    }

    render(
      <ClientFlowProvider>
        <BookingHarness />
      </ClientFlowProvider>,
    );

    expect(screen.getByTestId('conflict').textContent).toBe('true');
  });

  it('Scenario 5: SettingsPage business profile & setup wizard controls render cleanly', () => {
    render(
      <ClientFlowProvider>
        <SettingsPage />
      </ClientFlowProvider>,
    );
    expect(screen.getByText('پروفایل کسب‌وکار، مالیات، واحدها و ساعات کاری')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /راه‌اندازی سریع با ویزارد/ })).toBeInTheDocument();
  });
});
