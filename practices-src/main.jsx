import React from 'react';
import { createRoot } from 'react-dom/client';
import './practices.css';

const navItems = ['Home', 'Media', 'Practice', 'Inbox', 'Profile'];

function StatusBar() {
  return (
    <div className="status-bar" aria-label="Device status">
      <span>9:41</span>
      <span className="status-icons" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    </div>
  );
}

function Card({ className = '', children }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Button({ variant = 'primary', block = false, children }) {
  return (
    <button className={`btn btn-${variant}${block ? ' btn-block' : ''}`} type="button">
      {children}
    </button>
  );
}

function Chip({ active = false, children }) {
  return <button className={`chip${active ? ' is-active' : ''}`} type="button">{children}</button>;
}

function Input({ label, as = 'input', placeholder = '', value = '' }) {
  const Control = as;
  return (
    <label className="field">
      <span className="label">{label}</span>
      <Control className={as === 'textarea' ? 'textarea' : 'input'} placeholder={placeholder} defaultValue={value} />
    </label>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <span className={`nav-item${item === 'Practice' ? ' active' : ''}`} key={item}>
          <span className="nav-dot" aria-hidden="true"></span>
          {item}
        </span>
      ))}
    </nav>
  );
}

function PhoneShell({ eyebrow, title, subtitle, children }) {
  return (
    <article className="app" aria-label={title}>
      <div className="screen">
        <StatusBar />
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="title">{title}</h1>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        <div className="screen-content">{children}</div>
      </div>
      <BottomNav />
    </article>
  );
}

function StepProgress({ step }) {
  const steps = ['General', 'Content', 'Review'];
  return (
    <div className="steps" aria-label="Practice setup progress">
      {steps.map((item, index) => {
        const state = index < step ? 'done' : index === step ? 'active' : '';
        return (
          <div className={`step ${state}`} key={item}>
            <span>{index + 1}</span>
            <b>{item}</b>
          </div>
        );
      })}
    </div>
  );
}

function FeatureRow({ title, text }) {
  return (
    <div className="feature-row">
      <span className="feature-icon" aria-hidden="true"></span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

function MyPracticesScreen() {
  return (
    <PhoneShell title="My practices" subtitle="Practices you create for learners.">
      <Card className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M8.5 9.5h7M8.5 13h4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="empty-title">Nothing yet</h2>
        <p className="empty-text">Create your first practice - learners will see it in the Practice section.</p>
      </Card>

      <Button block>+ Create practice</Button>

      <div className="feature-list">
        <FeatureRow title="Different formats" text="Quizzes, flashcards, fill in the blanks and more." />
        <FeatureRow title="Help learners" text="Share useful practice materials for language learners." />
        <FeatureRow title="Track progress" text="See how many learners use your practices." />
      </div>
    </PhoneShell>
  );
}

function NewPracticeGeneralScreen() {
  return (
    <PhoneShell eyebrow="New practice" title="New practice">
      <StepProgress step={0} />

      <Card className="section">
        <h2 className="section-title">Basic information</h2>
        <div className="stack-16">
          <Input label="Title" placeholder="e.g. Articles A1" />
          <Input label="Description" as="textarea" placeholder="Optional" />
        </div>
      </Card>

      <Card className="section">
        <h2 className="section-title">Practice language</h2>
        <div className="chips">
          <Chip active>German</Chip>
          <Chip>English</Chip>
          <Chip>Spanish</Chip>
        </div>
      </Card>

      <Card className="section">
        <h2 className="section-title">Target level</h2>
        <div className="chips">
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level, index) => <Chip active={index === 0} key={level}>{level}</Chip>)}
        </div>
      </Card>

      <Card className="section">
        <h2 className="section-title">Format</h2>
        <div className="format-grid">
          {['Quiz', 'Flashcards', 'Fill in the blank', 'Matching'].map((format, index) => <Chip active={index === 0} key={format}>{format}</Chip>)}
        </div>
      </Card>

      <Button block>Continue -&gt;</Button>
    </PhoneShell>
  );
}

function QuickCard({ active = false, title }) {
  return (
    <button className={`quick-card${active ? ' active' : ''}`} type="button">
      <span className="quick-symbol" aria-hidden="true"></span>
      {title}
    </button>
  );
}

function OptionRow({ active = false, value }) {
  return (
    <div className="option-row">
      <button className={`option-mark${active ? ' active' : ''}`} type="button" aria-label={active ? 'Correct answer' : 'Mark correct'}>
        <span>✓</span>
      </button>
      <input className={`option-input${active ? ' active' : ''}`} defaultValue={value} />
    </div>
  );
}

function NewPracticeContentScreen() {
  return (
    <PhoneShell eyebrow="New practice" title="New practice">
      <StepProgress step={1} />

      <Card className="section">
        <h2 className="section-title">Quick fill</h2>
        <div className="quick-grid">
          <QuickCard active title="AI by topic" />
          <QuickCard title="Paste text" />
          <QuickCard title="Excel / CSV" />
        </div>
        <p className="helper">Generate questions with AI, paste text or upload a file.</p>
      </Card>

      <Card className="section item-card">
        <h2 className="section-title">Item 1</h2>
        <Input label="Question text" placeholder="Write the question" />

        <div className="answers">
          <span className="label">Answer options</span>
          <OptionRow active value="der Artikel" />
          <OptionRow value="die Artikel" />
          <OptionRow value="das Artikel" />
          <OptionRow value="den Artikel" />
        </div>

        <Input label="Explanation" as="textarea" placeholder="Optional" />
      </Card>

      <button className="dashed-box" type="button">+ Add item</button>

      <div className="footer-actions">
        <Button variant="secondary">Save draft</Button>
        <Button>Publish</Button>
      </div>
    </PhoneShell>
  );
}

function App() {
  return (
    <main className="prototype-stage">
      <MyPracticesScreen />
      <NewPracticeGeneralScreen />
      <NewPracticeContentScreen />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
