import unittest

import pandas as pd

from ml.train import build_supervised_examples


class BuildSupervisedExamplesTests(unittest.TestCase):
    def test_features_use_only_prior_consecutive_months(self):
        months = pd.period_range("2020-01", periods=15, freq="M")
        monthly = pd.DataFrame(
            {
                "product": ["Millet"] * len(months),
                "region": ["Dakar"] * len(months),
                "market": ["Sandaga"] * len(months),
                "month": months,
                "price": [100 + index for index in range(len(months))],
            }
        )
        monthly = monthly.loc[monthly["month"] != pd.Period("2020-03", freq="M")]

        examples = build_supervised_examples(monthly)
        april = examples.loc[
            examples["target_month"].eq(pd.Period("2020-04", freq="M"))
        ]
        may = examples.loc[
            examples["target_month"].eq(pd.Period("2020-05", freq="M"))
        ].iloc[0]

        self.assertTrue(april.empty)
        self.assertEqual(may["lag_1"], 103)
        self.assertTrue(pd.isna(may["lag_2"]))
        self.assertEqual(may["target_price"], 104)
