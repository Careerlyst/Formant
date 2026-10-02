import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { load, patch } from '../lib/store';

const QUESTIONS = [
  {
    id: 'service',
    eyebrow: '01 / WHAT DO YOU NEED?',
    title: 'What are you looking for help with?',
    multiple: true,
    options: [
      ['resume', 'Resume / CV'],
      ['linkedin', 'LinkedIn'],
      ['portfolio', 'Portfolio'],
      ['github', 'GitHub'],
      ['cover_letter', 'Cover Letter'],
      ['interview', 'Interview Preparation'],
      ['unsure', 'Not sure yet']
    ]
  },
  {
    id: 'situation',
    eyebrow: '02 / WHERE ARE YOU NOW?',
    title: 'What are you currently preparing for?',
    options: [
      ['job_search', 'Applying for jobs'],
      ['career_switch', 'Switching careers'],
      ['internship', 'Looking for internships'],
      ['interview', 'Preparing for interviews'],
      ['profile', 'Improving my professional profile'],
      ['exploring', 'Just exploring my options']
    ]
  },
  {
    id: 'urgency',
    eyebrow: '03 / TIMING',
    title: 'How soon do you need it?',
    options: [
      ['less_than_day', 'Less than a day (Urgent)'],
      ['1_3_days', 'Within 1–3 days'],
      ['1_week', 'Within 1 week'],
      ['2_4_weeks', 'Within 2–4 weeks'],
      ['1_3_months', 'Within 1–3 months'],
      ['exploring', 'Just exploring for now']
    ]
  },
  {
    id: 'materials',
    eyebrow: '04 / STARTING POINT',
    title: 'Do you already have something we can work with?',
    options: [
      ['yes', 'Yes, I have existing materials'],
      ['some', 'I have some materials'],
      ['no', 'No, I’m starting from scratch'],
      ['unsure', 'I’m not sure what I need']
    ]
  },
  {
    id: 'activity',
    eyebrow: '05 / INTENT',
    title: 'What best describes your current situation?',
    options: [
      ['actively_applying', 'I’m actively applying for opportunities'],
      ['upcoming', 'I have an upcoming interview/application'],
      ['preparing', 'I’m preparing before I start applying'],
      ['unhappy', 'I’m unhappy with my current profile'],
      ['researching', 'I’m only researching right now']
    ]
  },
  {
    id: 'budget',
    eyebrow: '06 / INVESTMENT',
    title: 'How much are you looking to invest in getting this done professionally?',
    options: [
      ['under_25', 'Under $25'],
      ['25_50', '$25–$50'],
      ['50_100', '$50–$100'],
      ['100_plus', '$100+'],
      ['unsure', 'I’m not sure yet']
    ]
  },
  {
    id: 'readiness',
    eyebrow: '07 / NEXT STEP',
    title: 'If we can provide the right service for your needs, how soon would you be ready to get started?',
    options: [
      ['now', 'I’m ready to start now'],
      ['few_days', 'Within a few days'],
      ['few_weeks', 'Within a few weeks'],
      ['comparing', 'I’m still comparing options'],
      ['exploring', 'Just exploring']
    ]
  }
];

function calculateLeadScore(answers) {
  let score = 0;

  // Question 1 can contain multiple services.
  // Selecting one or more actual services gives +2 total.
  const selectedServices = Array.isArray(answers.service)
    ? answers.service
    : answers.service
      ? [answers.service]
      : [];

  const serviceOptions = [
    'resume',
    'linkedin',
    'portfolio',
    'github',
    'cover_letter',
    'interview'
  ];

  if (
    selectedServices.some((service) =>
      serviceOptions.includes(service)
    )
  ) {
    score += 2;
  }

  // Situation
  if (
    [
      'job_search',
      'career_switch',
      'internship',
      'interview',
      'profile'
    ].includes(answers.situation)
  ) {
    score += 2;
  }

  // Urgency
  if (answers.urgency === 'less_than_day') {
    score += 4;
  } else if (answers.urgency === '1_3_days') {
    score += 3;
  } else if (answers.urgency === '1_week') {
    score += 2;
  } else if (answers.urgency === '2_4_weeks') {
    score += 1;
  }

  // Existing materials
  if (answers.materials === 'yes') {
    score += 1;
  }

  // Current activity
  if (
    answers.activity === 'actively_applying' ||
    answers.activity === 'upcoming'
  ) {
    score += 2;
  }

  // Budget
  if (
    answers.budget === '50_100' ||
    answers.budget === '100_plus'
  ) {
    score += 2;
  } else if (answers.budget === '25_50') {
    score += 1;
  }

  // Readiness
  if (answers.readiness === 'now') {
    score += 3;
  } else if (answers.readiness === 'few_days') {
    score += 2;
  } else if (answers.readiness === 'few_weeks') {
    score += 1;
  }

  return score;
}

function getLeadStatus(score) {
  if (score >= 10) return 'hot';
  if (score >= 6) return 'warm';
  if (score >= 3) return 'cold';
  return 'exploring';
}

export default function LeadAssessment() {
  const navigate = useNavigate();

  const stored = load();

  const [step, setStep] = useState(0);

  const [answers, setAnswers] = useState(
    stored.leadAssessment?.answers || {}
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const question = QUESTIONS[step];

  const selected = answers[question.id];

  const progress = Math.round(
    ((step + 1) / QUESTIONS.length) * 100
  );

  const scorePreview = useMemo(
    () => calculateLeadScore(answers),
    [answers]
  );

  /*
    Check whether an option is selected.

    Question 1:
    selected = array

    Other questions:
    selected = string
  */
  function isSelected(value) {
    if (question.multiple) {
      return (
        Array.isArray(selected) &&
        selected.includes(value)
      );
    }

    return selected === value;
  }

  /*
    Handle option selection.
  */
  function choose(value) {
    setAnswers((current) => {
      /*
        Question 1 allows multiple selections.
      */
      if (question.multiple) {
        const currentValues = Array.isArray(
          current.service
        )
          ? current.service
          : [];

        /*
          "Not sure yet" is exclusive.
        */
        if (value === 'unsure') {
          return {
            ...current,
            service: ['unsure']
          };
        }

        /*
          Selecting an actual service removes
          "Not sure yet".
        */
        const withoutUnsure =
          currentValues.filter(
            (item) => item !== 'unsure'
          );

        /*
          Toggle selection.
        */
        const alreadySelected =
          withoutUnsure.includes(value);

        return {
          ...current,
          service: alreadySelected
            ? withoutUnsure.filter(
                (item) => item !== value
              )
            : [...withoutUnsure, value]
        };
      }

      /*
        All other questions remain single-select.
      */
      return {
        ...current,
        [question.id]: value
      };
    });

    setError('');
  }

  /*
    Save assessment.
  */
  async function finish() {
    setSaving(true);
    setError('');

    const leadScore =
      calculateLeadScore(answers);

    const leadStatus =
      getLeadStatus(leadScore);

    const assessment = {
      answers,
      leadScore,
      leadStatus,
      completedAt:
        new Date().toISOString(),
      version: 1
    };

    try {
      /*
        Save to Supabase user metadata.
      */
      if (supabase) {
        const {
          error: updateError
        } = await supabase.auth.updateUser({
          data: {
            careerlyst_assessment_completed: true,
            careerlyst_lead_assessment:
              assessment
          }
        });

        if (updateError) {
          throw updateError;
        }
      }

      /*
        Save to local Formant store.
      */
      patch((current) => ({
        ...current,
        leadAssessment: assessment
      }));

      /*
        Assessment complete.
      */
      navigate('/dashboard', {
        replace: true
      });

    } catch (saveError) {
      console.error(
        'Lead assessment save error:',
        saveError
      );

      setError(
        saveError?.message ||
        'We could not save your answers. Please try again.'
      );

    } finally {
      setSaving(false);
    }
  }

  /*
    Continue to next question.
  */
  function next() {
    let hasSelection = false;

    if (question.multiple) {
      hasSelection =
        Array.isArray(selected) &&
        selected.length > 0;
    } else {
      hasSelection = Boolean(selected);
    }

    if (!hasSelection) {
      setError(
        question.multiple
          ? 'Choose at least one option to continue.'
          : 'Choose one option to continue.'
      );

      return;
    }

    /*
      Last question → save assessment.
    */
    if (step === QUESTIONS.length - 1) {
      finish();
      return;
    }

    setStep(
      (current) => current + 1
    );
  }

  /*
    Go back.
  */
  function back() {
    setError('');

    setStep(
      (current) =>
        Math.max(0, current - 1)
    );
  }

  return (
    <main className="lead-assessment">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="lead-assessment-header">

        <Logo />

        <span>
          CAREER PROFILE /{' '}
          {String(step + 1).padStart(2, '0')}
          {' '}
          OF{' '}
          {String(QUESTIONS.length).padStart(2, '0')}
        </span>

      </header>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <section className="lead-assessment-main">

        {/* Progress */}

        <div
          className="lead-assessment-progress"
          aria-label={`Assessment progress: ${progress}%`}
        >
          <span
            style={{
              width: `${progress}%`
            }}
          />
        </div>


        <div className="lead-assessment-layout">

          {/* =================================================
              ASIDE
          ================================================= */}

          <aside className="lead-assessment-aside">

            <p className="eyebrow">
              A QUICK START
            </p>

            <h1>
              Let’s understand what you need.
            </h1>

            <p>
              Seven quick questions help us
              understand your situation and
              point you toward the right
              Formant service.
            </p>

            <span className="lead-assessment-note">
              About 2 minutes
            </span>

          </aside>


          {/* =================================================
              CARD
          ================================================= */}

          <div className="lead-assessment-card">

            <p className="lead-assessment-eyebrow">
              {question.eyebrow}
            </p>

            <h2>
              {question.title}
            </h2>

            {question.multiple && (
              <p className="lead-assessment-hint">
                Select all that apply.
              </p>
            )}


            <div
              className="lead-assessment-options"
              role={
                question.multiple
                  ? 'group'
                  : 'radiogroup'
              }
              aria-label={question.title}
            >

              {question.options.map(
                ([value, label], index) => (

                  <button
                    key={value}
                    type="button"
                    className={`
                      lead-assessment-option
                      ${
                        isSelected(value)
                          ? 'is-selected'
                          : ''
                      }
                    `}
                    role={
                      question.multiple
                        ? 'checkbox'
                        : 'radio'
                    }
                    aria-checked={isSelected(value)}
                    onClick={() =>
                      choose(value)
                    }
                  >

                    <span className="lead-assessment-option-index">
                      {String.fromCharCode(
                        65 + index
                      )}
                    </span>

                    <span>
                      {label}
                    </span>

                    <span className="lead-assessment-option-mark">
                      {isSelected(value)
                        ? '✓'
                        : '↗'}
                    </span>

                  </button>

                )
              )}

            </div>


            {/* Error */}

            {error && (
              <p
                className="lead-assessment-error"
                role="alert"
              >
                {error}
              </p>
            )}


            {/* Actions */}

            <div className="lead-assessment-actions">

              <button
                type="button"
                className="lead-assessment-back"
                onClick={back}
                disabled={
                  step === 0 ||
                  saving
                }
              >
                ← Back
              </button>

              <button
                type="button"
                className="btn lime lead-assessment-next"
                onClick={next}
                disabled={saving}
              >
                {saving
                  ? 'Saving…'
                  : step === QUESTIONS.length - 1
                    ? 'Finish assessment ↗'
                    : 'Continue ↗'}
              </button>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="lead-assessment-footer">

        <span>
          FORMANT
        </span>

        <span>
          YOUR ANSWERS HELP US UNDERSTAND YOUR NEEDS
        </span>

        <span>
          {scorePreview > 0
            ? 'PROFILE IN PROGRESS'
            : 'STARTING POINT'}
        </span>

      </footer>

    </main>
  );
}