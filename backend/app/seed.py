"""Seed the database with sample positions and a demo researcher.

Runs on startup only when the tables are empty, so it's safe to leave on.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import models

_SAMPLE_POSITIONS = [
    dict(
        title="Postdoctoral Researcher — Machine Learning for Genomics",
        institution="Stanford University",
        field="Computational Biology",
        location="Stanford, CA, USA",
        keywords="machine learning, genomics, deep learning, bioinformatics, python",
        description=(
            "Join our lab developing deep learning models for genomic sequence "
            "analysis. Experience with PyTorch and large-scale sequencing data preferred."
        ),
        salary_min=68000,
        salary_max=78000,
        source="Nature Careers",
        url="https://example.edu/jobs/ml-genomics",
    ),
    dict(
        title="Postdoc in Condensed Matter Physics",
        institution="MIT",
        field="Physics",
        location="Cambridge, MA, USA",
        keywords="condensed matter, quantum materials, superconductivity, experiment",
        description=(
            "Experimental postdoc studying quantum materials and unconventional "
            "superconductivity using low-temperature transport measurements."
        ),
        salary_min=65000,
        salary_max=72000,
        source="APS Physics Jobs",
        url="https://example.edu/jobs/cmp",
    ),
    dict(
        title="Postdoctoral Fellow — Natural Language Processing",
        institution="University of Edinburgh",
        field="Computer Science",
        location="Edinburgh, UK",
        keywords="nlp, natural language processing, machine learning, transformers, llm",
        description=(
            "Research fellow position on large language models, evaluation, and "
            "low-resource NLP within the Institute for Language, Cognition and Computation."
        ),
        salary_min=40000,
        salary_max=48000,
        source="jobs.ac.uk",
        url="https://example.ac.uk/jobs/nlp",
    ),
    dict(
        title="Postdoc — Climate Modeling and Ocean Dynamics",
        institution="ETH Zurich",
        field="Earth Sciences",
        location="Zurich, Switzerland",
        keywords="climate, ocean dynamics, numerical modeling, fluid dynamics, python",
        description=(
            "Develop and analyze high-resolution ocean circulation models to study "
            "climate variability. Strong numerical and programming skills required."
        ),
        salary_min=85000,
        salary_max=95000,
        source="EURAXESS",
        url="https://example.ch/jobs/climate",
    ),
    dict(
        title="Postdoctoral Researcher — Immunology & Cancer Biology",
        institution="Memorial Sloan Kettering",
        field="Biology",
        location="New York, NY, USA",
        keywords="immunology, cancer, t-cells, flow cytometry, molecular biology",
        description=(
            "Investigate tumor-immune interactions and novel immunotherapy targets "
            "using single-cell and in vivo models."
        ),
        salary_min=70000,
        salary_max=80000,
        source="Science Careers",
        url="https://example.org/jobs/immuno",
    ),
    dict(
        title="Postdoc in Reinforcement Learning & Robotics",
        institution="ETH Zurich",
        field="Computer Science",
        location="Zurich, Switzerland",
        keywords="reinforcement learning, robotics, machine learning, control, python",
        description=(
            "Work at the intersection of RL and robotic manipulation, deploying "
            "learned policies on real hardware."
        ),
        salary_min=88000,
        salary_max=98000,
        source="EURAXESS",
        url="https://example.ch/jobs/rl-robotics",
    ),
    dict(
        title="Postdoctoral Position — Astrophysics / Exoplanets",
        institution="Caltech",
        field="Astronomy",
        location="Pasadena, CA, USA",
        keywords="astrophysics, exoplanets, spectroscopy, data analysis, python",
        description=(
            "Analyze transit and radial-velocity data to characterize exoplanet "
            "atmospheres. Experience with time-series analysis desired."
        ),
        salary_min=66000,
        salary_max=75000,
        source="AAS Job Register",
        url="https://example.edu/jobs/exoplanets",
    ),
    dict(
        title="Postdoc — Health Economics & Causal Inference",
        institution="London School of Economics",
        field="Economics",
        location="London, UK",
        keywords="econometrics, causal inference, health economics, statistics, r",
        description=(
            "Apply modern causal inference methods to health policy questions using "
            "large administrative datasets."
        ),
        salary_min=42000,
        salary_max=50000,
        source="jobs.ac.uk",
        url="https://example.ac.uk/jobs/health-econ",
    ),
]


def seed(db: Session) -> None:
    if db.query(models.Position).count() == 0:
        today = date.today()
        for i, data in enumerate(_SAMPLE_POSITIONS):
            position = models.Position(
                posted_at=today - timedelta(days=i * 3),
                deadline=today + timedelta(days=30 + i * 5),
                **data,
            )
            db.add(position)
        db.commit()

    if db.query(models.Researcher).count() == 0:
        demo = models.Researcher(
            name="Dr. Demo Researcher",
            email="demo@postdocengine.dev",
            field="Computer Science",
            institution="University of Example",
            keywords="machine learning, nlp, deep learning, python, transformers",
            bio="PhD in ML. Interested in NLP, representation learning, and applied AI.",
        )
        db.add(demo)
        db.commit()
