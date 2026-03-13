async function main() {
  const res = await fetch('http://localhost:3001/api/satellites');
  const data = await res.json();
  console.log('Total:', data.length);
  if (data.length > 0) {
    console.log('First:', JSON.stringify(data[0]).substring(0, 200));
  }
  const iss = data.filter(s => s.noradId === 25544);
  console.log('ISS count:', iss.length);
  const nonIss = data.filter(s => s.noradId !== 25544);
  console.log('Non-ISS count:', nonIss.length);
  const cats = {};
  data.forEach(s => { cats[s.category] = (cats[s.category] || 0) + 1; });
  console.log('Categories:', JSON.stringify(cats));
}
main();
