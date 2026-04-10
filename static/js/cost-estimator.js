document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cost-estimator-form');
    const resultSection = document.getElementById('cost-result-section');
    const valObj = document.getElementById('cost-value');
    const explObj = document.getElementById('cost-explanation-text');
    const futImpObj = document.getElementById('cost-future-improvement');

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const severity = document.getElementById('cost-severity').value;
            const size = document.getElementById('cost-size').value;
            const roadType = document.getElementById('cost-road-type').value;

            // Optional loading state
            valObj.innerHTML = '<span style="font-size:1.5rem;color:#888;">Calculating...</span>';
            resultSection.style.display = 'block';

            try {
                const response = await fetch('/api/estimate-cost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        severity: severity,
                        size: size,
                        road_type: roadType
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to calculate cost estimation');
                }

                const result = await response.json();
                
                // Display outputs
                valObj.textContent = result.formatted_range;
                explObj.textContent = result.explanation;
                futImpObj.innerHTML = `<strong>Data Extensibility:</strong> ${result.future_improvement}`;
                
                // Scroll down to see result if on a smaller screen
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'end' });

            } catch (error) {
                console.error("Error calculating cost:", error);
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast("Calculation failed: " + error.message);
                } else {
                    alert("Calculation failed: " + error.message);
                }
            }
        });
    }
});
