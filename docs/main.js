"use strict"

let messages = {}

async function loadMessages(locale = 'en_us') {
    try {
        const response = await fetch(`_locales/${locale}/messages.json`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        messages = await response.json()
    } catch (error) {
        console.error("Could not load messages:", error)
        // Fallback to an empty object, so getMessage returns keys
        messages = {}
    }
}

function getMessage(key, substitutions = {}) {
    const keys = key.split('.')
    let message = keys.reduce((obj, k) => (obj && typeof obj[k] !== 'undefined') ? obj[k] : undefined, messages)

    if (typeof message === 'undefined') {
        // console.warn(`Translation key not found: ${key}`);
        return key // Return the key itself if not found
    }

    // If the result is an object, it might be a Chrome i18n style message object
    if (typeof message === 'object' && message !== null && typeof message.message === 'string') {
        message = message.message
    } else if (typeof message !== 'string') {
        // If it's still not a string, return the key
        // console.warn(`Translation for key '${key}' is not a string:`, message);
        return key
    }

    for (const placeholder in substitutions) {
        message = message.replace(new RegExp(`\\$${placeholder}\\$`, 'g'), substitutions[placeholder])
    }
    return message
}

function translatePageElements() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n
        const translation = getMessage(key)
        if (element.dataset.i18nAttr) {
            element.setAttribute(element.dataset.i18nAttr, translation)
        } else if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') && element.placeholder) {
            element.placeholder = translation
        }
        else {
            element.textContent = translation
        }
    })

    const pageTitleKey = document.documentElement.dataset.i18nTitle
    if (pageTitleKey) {
        document.title = getMessage(pageTitleKey)
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadMessages() // Load messages first
    translatePageElements() // Translate static elements

    // --- Data definitions with message keys ---
    const functionalityData = {
        "func-cli": {
            titleKey: "funcData.cli.title",
            descriptionKey: "funcData.cli.description"
        },
        "func-vscode": {
            titleKey: "funcData.vscode.title",
            descriptionKey: "funcData.vscode.description"
        },
        "func-auditor": {
            titleKey: "funcData.auditor.title",
            descriptionKey: "funcData.auditor.description"
        },
        "func-generator": {
            titleKey: "funcData.generator.title",
            descriptionKey: "funcData.generator.description"
        },
        "func-modifier": {
            titleKey: "funcData.modifier.title",
            descriptionKey: "funcData.modifier.description"
        }
    }

    const techStackOriginalLabels = ['TypeScript', 'PNPM', 'Turborepo', 'Vitest', 'Commander.js', 'semantic-release', 'GitHub Actions', 'Biome/ESLint']
    const techStackChartData = {
        labels: techStackOriginalLabels.map(label => getMessage(`techStack.label.${label.toLowerCase().replace(/[/.\s-]/g, '')}`)),
        datasets: [{
            label: getMessage('techStack.datasetLabel'),
            data: [100, 95, 95, 90, 85, 90, 98, 88], // Keep data as is
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
        }]
    }

    const stackDetailsData = techStackOriginalLabels.reduce((acc, label) => {
        acc[label] = `techStack.details.${label.toLowerCase().replace(/[/.\s-]/g, '')}`
        return acc
    }, {})

    const workflowData = {
        branch: {
            titleKey: 'workflow.details.branch.title',
            pointKeys: [
                'workflow.details.branch.points.0',
                'workflow.details.branch.points.1',
                'workflow.details.branch.points.2',
            ]
        },
        pr: {
            titleKey: 'workflow.details.pr.title',
            pointKeys: [
                'workflow.details.pr.points.0',
                'workflow.details.pr.points.1',
                'workflow.details.pr.points.2',
            ]
        },
        ci: {
            titleKey: 'workflow.details.ci.title',
            pointKeys: [
                'workflow.details.ci.points.0',
                'workflow.details.ci.points.1',
                'workflow.details.ci.points.2',
            ]
        },
        merge: {
            titleKey: 'workflow.details.merge.title',
            pointKeys: [
                'workflow.details.merge.points.0',
                'workflow.details.merge.points.1',
                'workflow.details.merge.points.2',
            ]
        },
        release: {
            titleKey: 'workflow.details.release.title',
            pointKeys: [
                'workflow.details.release.points.0',
                'workflow.details.release.points.1',
                'workflow.details.release.points.2',
            ]
        }
    }

    // --- Functionality Section ---
    const funcDetailsEl = document.getElementById('functionality-details')
    document.querySelectorAll('.func-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.func-item').forEach(i => i.classList.remove('bg-blue-100', 'border-blue-500'))
            item.classList.add('bg-blue-100', 'border-blue-500')
            const data = functionalityData[item.id]
            if (data) {
                funcDetailsEl.style.opacity = 0
                setTimeout(() => {
                    funcDetailsEl.innerHTML = `
                        <h4 class="font-semibold text-stone-800">${getMessage(data.titleKey)}</h4>
                        <p class="mt-2 text-stone-600">${getMessage(data.descriptionKey)}</p>
                       `
                    funcDetailsEl.style.opacity = 1
                }, 150)
            }
        })
    })

    // --- Tech Stack Chart Section ---
    const ctx = document.getElementById('techStackChart').getContext('2d')
    const stackDetailsEl = document.getElementById('stack-details')
    const techStackChart = new Chart(ctx, {
        type: 'bar',
        data: techStackChartData,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    display: false,
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index
                    const originalLabel = techStackOriginalLabels[index] // Use original label for lookup
                    const detailKey = stackDetailsData[originalLabel]
                    const details = getMessage(detailKey)
                    const translatedLabel = techStackChartData.labels[index] // Display translated label

                    stackDetailsEl.style.opacity = 0
                    setTimeout(() => {
                        stackDetailsEl.innerHTML = `
                                <h4 class="font-semibold text-stone-800">${translatedLabel}</h4>
                                <p class="mt-2 text-stone-600">${details}</p>
                            `
                        stackDetailsEl.style.opacity = 1
                    }, 150)
                }
            }
        }
    })

    // --- Workflow Section ---
    const workflowDetailsEl = document.getElementById('workflow-details')
    function displayWorkflowStepDetails(stepKey) {
        const data = workflowData[stepKey]
        if (data) {
            workflowDetailsEl.style.opacity = 0
            setTimeout(() => {
                workflowDetailsEl.innerHTML = `
                    <h4 class="font-semibold text-stone-800">${getMessage(data.titleKey)}</h4>
                    <ul class="mt-2 list-disc list-inside text-stone-600 space-y-1">
                        ${data.pointKeys.map(pKey => `<li>${getMessage(pKey)}</li>`).join('')}
                    </ul>
                   `
                workflowDetailsEl.style.opacity = 1
            }, 150)
        }
    }

    document.querySelectorAll('.workflow-step').forEach(step => {
        step.addEventListener('click', () => {
            document.querySelectorAll('.workflow-step > div').forEach(div => {
                div.classList.remove('border-blue-500')
                div.classList.add('border-stone-300', 'hover:border-blue-500')
            })
            const stepDiv = step.querySelector('div')
            stepDiv.classList.add('border-blue-500')
            stepDiv.classList.remove('border-stone-300', 'hover:border-blue-500')

            const stepKey = step.dataset.step
            displayWorkflowStepDetails(stepKey)
        })
    })
    // Initialize default workflow view
    displayWorkflowStepDetails('branch') // 'branch' is the key for the first step

    // --- Intersection Observer for active nav link and fade-in ---
    const sections = document.querySelectorAll('.section-fade-in')
    const navLinks = document.querySelectorAll('.nav-link')
    const headerHeight = document.getElementById('header').offsetHeight

    const observerOptions = {
        root: null,
        rootMargin: `-${headerHeight}px 0px 0px 0px`,
        threshold: 0.1
    }

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible')
                const id = entry.target.getAttribute('id')
                navLinks.forEach(link => {
                    link.classList.remove('active')
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active')
                    }
                })
            }
        })
    }, observerOptions)

    sections.forEach(section => {
        sectionObserver.observe(section)
    })

    // --- Footer Date ---
    const dateLocale = getMessage('footer.dateLocale')
    document.getElementById('generation-date').textContent = new Date().toLocaleDateString(dateLocale, {
        year: 'numeric', month: 'long', day: 'numeric'
    })

})