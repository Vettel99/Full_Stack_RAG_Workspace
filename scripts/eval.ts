import { runEvaluationEngine } from '@/lib/eval-engine';

async function main() {
  console.log('\nRAG Evaluation Harness');
  console.log('='.repeat(60) + '\n');

  const result = await runEvaluationEngine();

  const tableRows = result.details.map((d, i) => ({
    '#': i + 1,
    question: d.question.length > 52 ? d.question.slice(0, 49) + '…' : d.question,
    score: `${d.score}/10`,
    reasoning: d.reasoning.length > 68 ? d.reasoning.slice(0, 65) + '…' : d.reasoning,
  }));

  console.log('\n' + '='.repeat(60));
  console.log('Summary\n');
  console.table(tableRows);
  console.log(`\nAverage score: ${result.averageScore.toFixed(1)} / 10`);
  console.log(`Run ID: ${result.runId}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
