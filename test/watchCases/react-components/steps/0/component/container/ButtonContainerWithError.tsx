import * as React from "react";
import { Button, ButtonProps } from "../button/Button";
import { Container } from "./Container";

export class ButtonContainerWithError extends React.Component<ButtonProps, {}> {
  render() {
    const { ref, ...others } = this.props;

    return (
      <Container>
        <Button shouldNeverExist="test" {...others}/>
      </Container>
    );
  }
}
