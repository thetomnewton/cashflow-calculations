import {
  Cashflow,
  Output,
  PlanningYear,
} from '../../../types';
import { PersonIncomeTaxCalculator } from './person-calculator';

export { PersonIncomeTaxCalculator } from './person-calculator';

export class IncomeTaxService {
  constructor(
    private year: PlanningYear,
    private cashflow: Cashflow,
    private output: Output
  ) {}

  calculate() {
    this.cashflow.people.forEach((person) => {
      const calculator = new PersonIncomeTaxCalculator(
        person,
        this.year,
        this.cashflow,
        this.output
      );
      
      calculator.calculate();
    });
  }
}
