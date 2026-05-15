import RequestForm from '@/app/components/RequestForm';

export default function B2BPage() {
  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">
          Для бизнеса и учебных заведений
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
          Лицензии на использование музыки в рекламе, фильмах, заведениях и учебных программах.
          Годовой доступ для школ, колледжей и вузов.
        </p>
      </div>

      <RequestForm
        type="B2B"
        title="Заявка на лицензию"
        description="Расскажите о проекте — мы предложим подходящий вариант лицензирования и подготовим договор."
        fields={[
          { kind: 'text',  name: 'company',  label: 'Название организации / ОГРН', required: true },
          { kind: 'text',  name: 'contact',  label: 'Контактное лицо', required: true },
          { kind: 'email', name: 'email',    label: 'Email', required: true },
          { kind: 'tel',   name: 'phone',    label: 'Телефон' },
          { kind: 'textarea', name: 'purpose', label: 'Для чего нужна лицензия', required: true,
            placeholder: 'Тип проекта, тиражи, сроки, бюджет…' },
        ]}
        submitLabel="Отправить заявку"
      />
    </main>
  );
}
