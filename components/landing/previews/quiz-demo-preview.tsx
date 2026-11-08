"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Circle, CircleCheck, CircleX, RotateCcw, X } from "lucide-react";
import { demoQuestions, type DemoQuizMode } from "@/components/landing/demo-data";
import { gradeLandingDemoAnswer } from "@/lib/landing-demo-grading";

const modes: { id: DemoQuizMode; label: string }[] = [
  { id: "multiple-choice", label: "Multiple Choice" },
  { id: "identification", label: "Identification" },
  { id: "true-false", label: "True or False" },
  { id: "enumeration", label: "Enumeration" },
];
export function QuizDemoPreview() {
  const [mode, setMode] = useState<DemoQuizMode>("multiple-choice");
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState(["", "", ""]);
  const [result, setResult] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const question = demoQuestions[mode][index];
  const finished = index >= demoQuestions[mode].length;
  const canSubmit = mode === "multiple-choice" ? Boolean(choice) : mode === "enumeration" ? items.every((item) => item.trim()) : Boolean(text.trim());

  function changeMode(next: DemoQuizMode) {
    setMode(next); setIndex(0); setChoice(""); setText(""); setItems(["", "", ""]); setResult(null); setScore(0); setAnswered(0);
  }
  function submit() {
    if (!question || result !== null || !canSubmit) return;
    const answers = mode === "multiple-choice" ? [choice] : mode === "enumeration" ? items : [text];
    const correct = gradeLandingDemoAnswer(mode, question, answers);
    setResult(correct); setAnswered((value) => value + 1); if (correct) setScore((value) => value + 1);
  }
  function next() {
    setIndex((value) => value + 1); setChoice(""); setText(""); setItems(["", "", ""]); setResult(null);
  }
  function restart() {
    setIndex(0); setChoice(""); setText(""); setItems(["", "", ""]); setResult(null); setScore(0); setAnswered(0);
  }
  if (finished || !question) {
    return <section className="quiz-demo" aria-label="Interactive local quiz demo"><div className="quiz-demo-head"><div><span className="demo-chip">Demo Preview</span><h3>Biology Basics</h3></div><span className="quiz-demo-local"><Circle aria-hidden="true"/> Local demo</span></div><div className="quiz-mode-list" role="group" aria-label="Quiz format">{modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => changeMode(item.id)}>{item.label}</button>)}</div><div className="quiz-finish" role="status"><span className="quiz-finish-icon"><CheckCircle2 aria-hidden="true"/></span><p className="quiz-eyebrow">Demo complete</p><h4>You answered {answered} {answered === 1 ? "question" : "questions"}.</h4><p>Your local score: <strong>{score} / {answered}</strong></p><div className="quiz-finish-actions"><button type="button" onClick={restart} className="landing-button landing-button-secondary"><RotateCcw aria-hidden="true"/> Try Again</button><Link href="/register" className="landing-button landing-button-primary">Start Studying</Link></div></div></section>;
  }

  return <section className="quiz-demo" aria-label="Interactive local quiz demo">
    <div className="quiz-demo-head"><div><span className="demo-chip">Demo Preview</span><h3>Biology Basics</h3></div><span className="quiz-demo-local"><Circle aria-hidden="true"/> Local demo</span></div>
    <div className="quiz-mode-list" role="group" aria-label="Quiz format">{modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => changeMode(item.id)}>{item.label}</button>)}</div>
    <>
      <div className="quiz-progress-meta"><span>Question {index + 1} of {demoQuestions[mode].length}</span><span>{score} correct</span></div>
      <div className="quiz-progress-track" role="progressbar" aria-label="Demo quiz progress" aria-valuemin={0} aria-valuemax={demoQuestions[mode].length} aria-valuenow={index + (result !== null ? 1 : 0)}><span style={{ width: `${((index + (result !== null ? 1 : 0)) / demoQuestions[mode].length) * 100}%` }}/></div>
      <div className="quiz-question" key={`${mode}-${index}`}><span className="quiz-question-type">{modes.find((item) => item.id === mode)?.label}</span><h4>{question.prompt}</h4>
        {mode === "multiple-choice" && <div className="quiz-options" role="group" aria-label="Answer choices">{question.options?.map((option, optionIndex) => <button type="button" key={option} disabled={result !== null} aria-pressed={choice === option} onClick={() => setChoice(option)} className={`quiz-option${choice === option ? " is-selected" : ""}${result !== null && option === question.accepted?.[0] ? " is-correct" : ""}${result === false && choice === option ? " is-wrong" : ""}`}><span className="quiz-option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{result !== null && option === question.accepted?.[0] && <Check aria-label="Correct answer"/>}{result === false && choice === option && <X aria-label="Your answer"/>}</button>)}</div>}
        {mode === "true-false" && <div className="quiz-options quiz-binary" role="group" aria-label="Choose true or false">{["True", "False"].map((value) => <button type="button" key={value} disabled={result !== null} aria-pressed={text === value} onClick={() => setText(value)} className={`quiz-option${text === value ? " is-selected" : ""}${result !== null && value.toLowerCase() === question.accepted?.[0]?.toLowerCase() ? " is-correct" : ""}${result === false && text === value ? " is-wrong" : ""}`}>{value}</button>)}</div>}
        {mode === "identification" && <label className="quiz-text-answer"><span>Your answer</span><input value={text} disabled={result !== null} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && result === null && canSubmit) submit(); }} placeholder="Type your answer" /></label>}
        {mode === "enumeration" && <fieldset className="quiz-enumeration"><legend>Enter one item in each field</legend>{items.map((value, itemIndex) => <label key={itemIndex}><span className="sr-only">Item {itemIndex + 1}</span><span className="quiz-item-number">{itemIndex + 1}</span><input value={value} disabled={result !== null} onChange={(event) => setItems((current) => current.map((item, i) => i === itemIndex ? event.target.value : item))} placeholder={`Item ${itemIndex + 1}`} /></label>)}</fieldset>}
      </div>
      {result !== null && <div className={`quiz-feedback ${result ? "is-correct" : "is-wrong"}`} role="status" aria-live="polite"><span className="quiz-feedback-icon">{result ? <CircleCheck aria-hidden="true"/> : <CircleX aria-hidden="true"/>}</span><div><h5>{result ? "Correct!" : "Not quite yet."}</h5><p>{result ? "That's right." : `The answer is ${question.expected?.join(", ") ?? question.accepted?.join(" or ")}.`} {question.explanation}</p></div></div>}
      <div className="quiz-controls">{result === null ? <button type="button" disabled={!canSubmit} onClick={submit} className="landing-button landing-button-primary">Submit Answer</button> : <button type="button" onClick={next} className="landing-button landing-button-primary">{index + 1 === demoQuestions[mode].length ? "See Results" : "Next Question"}</button>}<span>Practice answers stay in this page.</span></div>
    </>
  </section>;
}
