import type { Customer } from '../types';
import { Customer360Page } from './customers/Customer360Page';
import { Modal } from './Modal';

interface CustomerDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onSelectCustomer?: (customer: Customer) => void;
  singularLabel?: string;
}

export function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  onSelectCustomer,
  singularLabel = 'مشتری',
}: CustomerDetailModalProps) {
  if (!customer) return null;

  return (
    <Modal open={Boolean(customer)} onClose={onClose} title={`پرونده ۳۶۰: ${customer.name}`} maxWidth="2xl">
      <Customer360Page
        customerId={customer.id}
        singularLabel={singularLabel}
        onEdit={onEdit}
        onSelectCustomer={(id) => {
          if (!onSelectCustomer) return;
          onSelectCustomer({ ...customer, id });
        }}
      />
    </Modal>
  );
}
